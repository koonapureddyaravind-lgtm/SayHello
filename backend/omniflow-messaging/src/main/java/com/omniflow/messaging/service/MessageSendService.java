package com.omniflow.messaging.service;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.MessageStatus;
import com.omniflow.common.domain.enums.UsageMetric;
import com.omniflow.common.port.BillingPort;
import com.omniflow.common.port.ProviderAccountInfo;
import com.omniflow.common.port.ProviderAccountResolver;
import com.omniflow.messaging.entity.Message;
import com.omniflow.messaging.entity.MessageAttempt;
import com.omniflow.messaging.provider.MessageProvider;
import com.omniflow.messaging.provider.ProviderRegistry;
import com.omniflow.messaging.repository.MessageAttemptRepository;
import com.omniflow.messaging.repository.MessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Executes one message send. The provider call happens outside any database
 * transaction; status changes are committed in short {@link TransactionTemplate}
 * phases so a slow provider never holds locks.
 */
@Service
public class MessageSendService {

    private static final Logger log = LoggerFactory.getLogger(MessageSendService.class);

    private final MessageRepository messageRepository;
    private final MessageAttemptRepository attemptRepository;
    private final ProviderRegistry providerRegistry;
    private final ProviderAccountResolver providerAccountResolver;
    private final RateLimiter rateLimiter;
    private final BillingPort billingPort;
    private final JdbcTemplate jdbcTemplate;
    private final TransactionTemplate transactionTemplate;

    public MessageSendService(MessageRepository messageRepository,
                              MessageAttemptRepository attemptRepository,
                              ProviderRegistry providerRegistry,
                              ProviderAccountResolver providerAccountResolver,
                              RateLimiter rateLimiter,
                              BillingPort billingPort,
                              JdbcTemplate jdbcTemplate,
                              PlatformTransactionManager transactionManager) {
        this.messageRepository = messageRepository;
        this.attemptRepository = attemptRepository;
        this.providerRegistry = providerRegistry;
        this.providerAccountResolver = providerAccountResolver;
        this.rateLimiter = rateLimiter;
        this.billingPort = billingPort;
        this.jdbcTemplate = jdbcTemplate;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public void send(UUID messageId) {
        Message message = messageRepository.findById(messageId).orElse(null);
        if (message == null) {
            log.warn("Message {} not found; send skipped", messageId);
            return;
        }
        if (message.getStatus() != MessageStatus.QUEUED && message.getStatus() != MessageStatus.FAILED) {
            log.debug("Message {} is {}; send skipped", messageId, message.getStatus());
            return;
        }
        if (!rateLimiter.tryAcquire(message.getOrganizationId(), message.getChannel())) {
            throw new RateLimitExceededException("rate limited");
        }
        if (message.getScheduledAt() != null && message.getScheduledAt().isAfter(Instant.now())) {
            log.debug("Message {} is scheduled for the future; send skipped", messageId);
            return;
        }

        UUID[] attemptId = {null};
        boolean[] started = {false};

        transactionTemplate.executeWithoutResult(status -> {
            Message current = messageRepository.findById(messageId).orElse(null);
            if (current == null
                    || (current.getStatus() != MessageStatus.QUEUED
                    && current.getStatus() != MessageStatus.FAILED)) {
                return;
            }
            current.setStatus(MessageStatus.SENDING);
            current.setErrorCode(null);
            current.setErrorMessage(null);
            messageRepository.save(current);

            MessageAttempt attempt = new MessageAttempt();
            attempt.setMessageId(current.getId());
            attempt.setOrganizationId(current.getOrganizationId());
            attempt.setAttemptNo(attemptRepository.findTopByMessageIdOrderByAttemptNoDesc(messageId)
                    .map(previous -> previous.getAttemptNo() + 1)
                    .orElse(1));
            attempt.setStatus("SENDING");
            attempt.setStartedAt(Instant.now());
            attempt.setRequestPayload(requestPayload(current));
            attemptRepository.save(attempt);

            attemptId[0] = attempt.getId();
            started[0] = true;
        });

        if (!started[0]) {
            return;
        }

        Message current = messageRepository.findById(messageId).orElse(null);
        if (current == null) {
            return;
        }

        ProviderAccountInfo account = resolveAccount(current);
        if (account == null) {
            fail(messageId, attemptId[0], null, "NO_PROVIDER",
                    "No provider account configured for channel " + current.getChannel(), Map.of());
            return;
        }

        MessageProvider provider = providerRegistry.find(account.provider()).orElse(null);
        if (provider == null) {
            fail(messageId, attemptId[0], account.provider(), "NO_PROVIDER_ADAPTER",
                    "No adapter registered for provider " + account.provider(), Map.of());
            return;
        }

        String fromAddress = current.getFromAddress() == null || current.getFromAddress().isBlank()
                ? account.fromAddress()
                : current.getFromAddress();

        MessageProvider.SendRequest request = new MessageProvider.SendRequest(
                current.getOrganizationId(),
                messageId,
                current.getChannel(),
                current.getToAddress(),
                fromAddress,
                account.fromName(),
                current.getSubject(),
                current.getBody(),
                current.getHtmlBody(),
                account.credentials(),
                account.config(),
                current.getIdempotencyKey(),
                current.getMetadata());

        MessageProvider.SendResult result;
        try {
            result = provider.send(request);
        } catch (Exception ex) {
            log.warn("Provider {} threw while sending message {}: {}", account.provider(), messageId, ex.getMessage());
            Map<String, Object> raw = new HashMap<>();
            raw.put("exception", ex.getClass().getSimpleName());
            raw.put("message", ex.getMessage());
            fail(messageId, attemptId[0], account.provider(), "PROVIDER_ERROR", ex.getMessage(), raw);
            return;
        }

        if (result == null) {
            fail(messageId, attemptId[0], account.provider(), "PROVIDER_ERROR", "Provider returned no result", Map.of());
            return;
        }

        if (result.success()) {
            markSent(messageId, attemptId[0], account.provider(), result);
        } else {
            String code = result.errorCode() == null || result.errorCode().isBlank()
                    ? "PROVIDER_ERROR" : result.errorCode();
            fail(messageId, attemptId[0], account.provider(), code, result.errorMessage(),
                    result.raw() == null ? Map.of() : result.raw());
        }
    }

    private void markSent(UUID messageId, UUID attemptId, String providerCode, MessageProvider.SendResult result) {
        transactionTemplate.executeWithoutResult(status -> {
            Message current = messageRepository.findById(messageId).orElse(null);
            if (current == null || !MessageStatusMachine.canTransition(current.getStatus(), MessageStatus.SENT)) {
                return;
            }
            current.setStatus(MessageStatus.SENT);
            current.setSentAt(Instant.now());
            current.setProvider(providerCode);
            current.setProviderMessageId(result.providerMessageId());
            current.setErrorCode(null);
            current.setErrorMessage(null);
            messageRepository.save(current);

            finishAttempt(attemptId, providerCode, "SENT", null, null,
                    result.raw() == null ? Map.of() : result.raw());

            if (current.getCampaignId() != null) {
                updateRecipientStatus(messageId, "SENT");
            }
        });

        Message committed = messageRepository.findById(messageId).orElse(null);
        if (committed != null) {
            try {
                billingPort.recordUsage(committed.getOrganizationId(), metricFor(committed.getChannel()),
                        1, committed.getCampaignId(), messageId);
            } catch (RuntimeException ex) {
                log.warn("Usage recording failed for message {}: {}", messageId, ex.getMessage());
            }
        }
    }

    private void fail(UUID messageId,
                      UUID attemptId,
                      String providerCode,
                      String errorCode,
                      String errorMessage,
                      Map<String, Object> raw) {
        transactionTemplate.executeWithoutResult(status -> {
            Message current = messageRepository.findById(messageId).orElse(null);
            if (current == null || !MessageStatusMachine.canTransition(current.getStatus(), MessageStatus.FAILED)) {
                return;
            }
            current.setStatus(MessageStatus.FAILED);
            current.setFailedAt(Instant.now());
            current.setErrorCode(errorCode);
            current.setErrorMessage(errorMessage);
            if (providerCode != null) {
                current.setProvider(providerCode);
            }
            messageRepository.save(current);

            finishAttempt(attemptId, providerCode, "FAILED", errorCode, errorMessage,
                    raw == null ? Map.of() : raw);

            if (current.getCampaignId() != null) {
                updateRecipientStatus(messageId, "FAILED");
            }
        });
    }

    private void finishAttempt(UUID attemptId,
                               String providerCode,
                               String status,
                               String errorCode,
                               String errorMessage,
                               Map<String, Object> responsePayload) {
        if (attemptId == null) {
            return;
        }
        attemptRepository.findById(attemptId).ifPresent(attempt -> {
            attempt.setStatus(status);
            if (providerCode != null) {
                attempt.setProvider(providerCode);
            }
            attempt.setErrorCode(errorCode);
            attempt.setErrorMessage(errorMessage);
            attempt.setResponsePayload(responsePayload == null ? Map.of() : responsePayload);
            attempt.setFinishedAt(Instant.now());
            attemptRepository.save(attempt);
        });
    }

    private void updateRecipientStatus(UUID messageId, String status) {
        jdbcTemplate.update(
                "update campaign_recipients set status = ?, updated_at = now() where message_id = ?",
                status, messageId);
    }

    private ProviderAccountInfo resolveAccount(Message message) {
        if (message.getProviderAccountId() != null) {
            return providerAccountResolver
                    .find(message.getOrganizationId(), message.getProviderAccountId())
                    .orElse(null);
        }
        return providerAccountResolver
                .findDefault(message.getOrganizationId(), message.getChannel())
                .orElse(null);
    }

    private static Map<String, Object> requestPayload(Message message) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("to", message.getToAddress());
        payload.put("channel", message.getChannel() == null ? null : message.getChannel().name());
        payload.put("subject", message.getSubject());
        payload.put("providerAccountId",
                message.getProviderAccountId() == null ? null : message.getProviderAccountId().toString());
        return payload;
    }

    private static UsageMetric metricFor(Channel channel) {
        return switch (channel) {
            case EMAIL -> UsageMetric.EMAIL_SENT;
            case WHATSAPP -> UsageMetric.WHATSAPP_SENT;
            case SMS -> UsageMetric.SMS_SENT;
        };
    }
}
