package com.omniflow.integration.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omniflow.common.crypto.CredentialCipher;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.ProviderAccountStatus;
import com.omniflow.common.port.ProviderAccountInfo;
import com.omniflow.common.port.ProviderAccountResolver;
import com.omniflow.integration.entity.ProviderAccount;
import com.omniflow.integration.repository.ProviderAccountRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProviderAccountResolverImpl implements ProviderAccountResolver {

    private static final Logger log = LoggerFactory.getLogger(ProviderAccountResolverImpl.class);

    private final ProviderAccountRepository repository;
    private final CredentialCipher credentialCipher;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional(readOnly = true)
    public Optional<ProviderAccountInfo> findDefault(UUID organizationId, Channel channel) {
        if (organizationId == null || channel == null) {
            return Optional.empty();
        }
        ProviderAccount account = repository
                .findByOrganizationIdAndChannelAndIsDefaultTrue(organizationId, channel)
                .orElseGet(() -> firstActive(organizationId, channel));
        return Optional.ofNullable(account).map(this::toInfo);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ProviderAccountInfo> find(UUID organizationId, UUID providerAccountId) {
        if (organizationId == null || providerAccountId == null) {
            return Optional.empty();
        }
        return repository.findByIdAndOrganizationId(providerAccountId, organizationId).map(this::toInfo);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ProviderAccountInfo> findById(UUID providerAccountId) {
        if (providerAccountId == null) {
            return Optional.empty();
        }
        return repository.findById(providerAccountId).map(this::toInfo);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ProviderAccountInfo> findByWhatsAppPhoneNumberId(String phoneNumberId) {
        if (phoneNumberId == null || phoneNumberId.isBlank()) {
            return Optional.empty();
        }
        return repository.findWhatsAppByPhoneNumberId(phoneNumberId.trim()).stream()
                .findFirst()
                .map(this::toInfo);
    }

    private ProviderAccount firstActive(UUID organizationId, Channel channel) {
        List<ProviderAccount> accounts = repository.findByOrganizationIdAndChannelOrderByNameAsc(organizationId, channel);
        return accounts.stream()
                .filter(account -> account.getStatus() == ProviderAccountStatus.ACTIVE)
                .findFirst()
                .orElse(null);
    }

    private ProviderAccountInfo toInfo(ProviderAccount account) {
        return new ProviderAccountInfo(
                account.getId(),
                account.getOrganizationId(),
                account.getChannel(),
                account.getProvider(),
                account.getName(),
                account.getFromAddress(),
                account.getFromName(),
                decryptCredentials(account.getEncryptedCredentials()),
                account.getConfig() == null ? Map.of() : account.getConfig(),
                account.isDefaultAccount());
    }

    private Map<String, String> decryptCredentials(String encrypted) {
        if (encrypted == null || encrypted.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(credentialCipher.decrypt(encrypted), new TypeReference<Map<String, String>>() {
            });
        } catch (Exception e) {
            log.warn("Unable to decrypt provider account credentials: {}", e.getMessage());
            return Map.of();
        }
    }
}
