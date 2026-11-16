package com.omniflow.integration.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omniflow.common.crypto.CredentialCipher;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.ProviderAccountStatus;
import com.omniflow.common.exception.BadRequestException;
import com.omniflow.common.exception.ConflictException;
import com.omniflow.common.exception.NotFoundException;
import com.omniflow.common.port.ProviderAccountInfo;
import com.omniflow.common.port.ProviderConnectivityChecker;
import com.omniflow.integration.dto.IntegrationTestResult;
import com.omniflow.integration.dto.IntegrationView;
import com.omniflow.integration.dto.UpsertIntegrationRequest;
import com.omniflow.integration.entity.ProviderAccount;
import com.omniflow.integration.repository.ProviderAccountRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class IntegrationService {

    private static final Logger log = LoggerFactory.getLogger(IntegrationService.class);

    private final ProviderAccountRepository repository;
    private final CredentialCipher credentialCipher;
    private final ObjectMapper objectMapper;
    private final List<ProviderConnectivityChecker> connectivityCheckers;

    @Transactional(readOnly = true)
    public List<IntegrationView> list(UUID organizationId) {
        return repository.findByOrganizationIdOrderByChannelAscNameAsc(organizationId).stream()
                .map(this::toView)
                .toList();
    }

    @Transactional
    public IntegrationView create(UUID organizationId, UpsertIntegrationRequest request) {
        if (request.channel() == null) {
            throw new BadRequestException("INVALID_INTEGRATION", "Channel is required");
        }
        if (isBlank(request.provider())) {
            throw new BadRequestException("INVALID_INTEGRATION", "Provider is required");
        }
        if (isBlank(request.name())) {
            throw new BadRequestException("INVALID_INTEGRATION", "Name is required");
        }
        if (repository.existsByOrganizationIdAndChannelAndName(
                organizationId, request.channel(), request.name().trim())) {
            throw new ConflictException("INTEGRATION_EXISTS",
                    "A provider account with this channel and name already exists");
        }

        ProviderAccount account = new ProviderAccount();
        account.setOrganizationId(organizationId);
        account.setChannel(request.channel());
        account.setProvider(request.provider().trim());
        account.setName(request.name().trim());
        account.setStatus(ProviderAccountStatus.ACTIVE);
        account.setConfig(request.config() == null ? Map.of() : request.config());
        account.setFromAddress(trimToNull(request.fromAddress()));
        account.setFromName(trimToNull(request.fromName()));
        account.setEncryptedCredentials(encryptCredentials(request.credentials()));

        boolean makeDefault = Boolean.TRUE.equals(request.isDefault());
        if (makeDefault) {
            clearExistingDefault(organizationId, request.channel(), null);
        }
        account.setDefaultAccount(makeDefault);

        repository.save(account);
        return toView(account);
    }

    @Transactional
    public IntegrationView update(UUID organizationId, UUID id, UpsertIntegrationRequest request) {
        ProviderAccount account = repository.findByIdAndOrganizationId(id, organizationId)
                .orElseThrow(() -> new NotFoundException("Integration", id));

        Channel effectiveChannel = request.channel() == null ? account.getChannel() : request.channel();
        String effectiveName = request.name() == null ? account.getName() : request.name().trim();

        repository.findByOrganizationIdAndChannelAndName(organizationId, effectiveChannel, effectiveName)
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw new ConflictException("INTEGRATION_EXISTS",
                            "A provider account with this channel and name already exists");
                });

        if (request.channel() != null) {
            account.setChannel(request.channel());
        }
        if (request.name() != null) {
            if (request.name().isBlank()) {
                throw new BadRequestException("INVALID_INTEGRATION", "Name cannot be blank");
            }
            account.setName(request.name().trim());
        }
        if (request.provider() != null) {
            if (request.provider().isBlank()) {
                throw new BadRequestException("INVALID_INTEGRATION", "Provider cannot be blank");
            }
            account.setProvider(request.provider().trim());
        }
        if (request.credentials() != null) {
            account.setEncryptedCredentials(encryptCredentials(request.credentials()));
        }
        if (request.config() != null) {
            account.setConfig(request.config());
        }
        if (request.fromAddress() != null) {
            account.setFromAddress(trimToNull(request.fromAddress()));
        }
        if (request.fromName() != null) {
            account.setFromName(trimToNull(request.fromName()));
        }

        boolean targetDefault = request.isDefault() == null ? account.isDefaultAccount() : request.isDefault();
        if (targetDefault) {
            clearExistingDefault(organizationId, account.getChannel(), id);
        }
        account.setDefaultAccount(targetDefault);

        repository.save(account);
        return toView(account);
    }

    @Transactional
    public void delete(UUID organizationId, UUID id) {
        ProviderAccount account = repository.findByIdAndOrganizationId(id, organizationId)
                .orElseThrow(() -> new NotFoundException("Integration", id));
        repository.delete(account);
    }

    @Transactional
    public IntegrationTestResult test(UUID organizationId, UUID id) {
        ProviderAccount account = repository.findByIdAndOrganizationId(id, organizationId)
                .orElseThrow(() -> new NotFoundException("Integration", id));

        String problem = validateConfiguration(account);
        if (problem != null) {
            return new IntegrationTestResult(false, problem);
        }

        Map<String, String> credentials = decryptCredentials(account.getEncryptedCredentials());
        Map<String, Object> config = account.getConfig() == null ? Map.of() : account.getConfig();
        ProviderAccountInfo info = new ProviderAccountInfo(
                account.getId(),
                account.getOrganizationId(),
                account.getChannel(),
                account.getProvider(),
                account.getName(),
                account.getFromAddress(),
                account.getFromName(),
                credentials,
                config,
                account.isDefaultAccount());

        for (ProviderConnectivityChecker checker : connectivityCheckers) {
            if (!checker.supports(account.getProvider(), account.getChannel())) {
                continue;
            }
            ProviderConnectivityChecker.Result result = checker.check(info);
            if (!result.ok()) {
                return new IntegrationTestResult(false, result.message());
            }
            account.setLastVerifiedAt(Instant.now());
            repository.save(account);
            return new IntegrationTestResult(true, result.message());
        }

        // Static-only providers (for example the development LOG sender) have no
        // live handshake. Passing validation is the strongest check available.
        account.setLastVerifiedAt(Instant.now());
        repository.save(account);
        return new IntegrationTestResult(true, "Provider account configuration looks valid");
    }

    private String validateConfiguration(ProviderAccount account) {
        Map<String, Object> config = account.getConfig() == null ? Map.of() : account.getConfig();
        Map<String, String> credentials = decryptCredentials(account.getEncryptedCredentials());

        return switch (account.getChannel()) {
            case EMAIL -> isBlank(account.getFromAddress())
                    ? "EMAIL provider requires a from address"
                    : null;
            case WHATSAPP -> isBlank(credentials.get("accessToken")) && isBlank(stringValue(config.get("phoneNumberId")))
                    ? "WHATSAPP provider requires credentials.accessToken or config.phoneNumberId"
                    : null;
            case SMS -> isBlank(account.getFromAddress()) && isBlank(stringValue(config.get("fromNumber")))
                    ? "SMS provider requires a from address or config.fromNumber"
                    : null;
        };
    }

    private void clearExistingDefault(UUID organizationId, Channel channel, UUID excludeId) {
        repository.findByOrganizationIdAndChannelAndIsDefaultTrue(organizationId, channel)
                .filter(existing -> excludeId == null || !excludeId.equals(existing.getId()))
                .ifPresent(existing -> {
                    existing.setDefaultAccount(false);
                    // Flush before inserting/updating the new default so the partial unique
                    // index (one default per org+channel) never sees two true rows.
                    repository.saveAndFlush(existing);
                });
    }

    private IntegrationView toView(ProviderAccount account) {
        return new IntegrationView(
                account.getId(),
                account.getChannel(),
                account.getProvider(),
                account.getName(),
                account.getStatus(),
                account.getFromAddress(),
                account.getFromName(),
                account.isDefaultAccount(),
                account.getConfig() == null ? Map.of() : account.getConfig(),
                !isBlank(account.getEncryptedCredentials()),
                account.getLastVerifiedAt(),
                account.getCreatedAt());
    }

    private String encryptCredentials(Map<String, String> credentials) {
        if (credentials == null || credentials.isEmpty()) {
            return null;
        }
        try {
            return credentialCipher.encrypt(objectMapper.writeValueAsString(credentials));
        } catch (Exception e) {
            throw new BadRequestException("INVALID_CREDENTIALS", "Credentials must be a flat string map");
        }
    }

    private Map<String, String> decryptCredentials(String encrypted) {
        if (isBlank(encrypted)) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(credentialCipher.decrypt(encrypted), new TypeReference<Map<String, String>>() {
            });
        } catch (Exception e) {
            log.warn("Unable to decrypt provider credentials: {}", e.getMessage());
            return Map.of();
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String stringValue(Object value) {
        return value == null ? null : value.toString();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
