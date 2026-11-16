package com.omniflow.messaging.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.MessageStatus;
import com.omniflow.common.domain.enums.WebhookStatus;
import com.omniflow.common.exception.BadRequestException;
import com.omniflow.messaging.entity.Message;
import com.omniflow.messaging.entity.MessageEvent;
import com.omniflow.messaging.entity.WebhookEvent;
import com.omniflow.messaging.repository.MessageEventRepository;
import com.omniflow.messaging.repository.MessageRepository;
import com.omniflow.messaging.repository.WebhookEventRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Applies provider delivery callbacks to messages. Events are idempotent on
 * (provider, provider_event_id) and only legal state-machine transitions are applied.
 */
@Service
@RequiredArgsConstructor
public class MessageWebhookService {

    private static final Logger log = LoggerFactory.getLogger(MessageWebhookService.class);

    private final WebhookEventRepository webhookEventRepository;
    private final MessageEventRepository messageEventRepository;
    private final MessageRepository messageRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Stores the raw webhook exactly once. Returns true when this call inserted it.
     */
    @Transactional
    public boolean recordRawWebhook(String provider, String eventId, Object payload, boolean signatureValid) {
        if (provider == null || provider.isBlank() || eventId == null || eventId.isBlank()) {
            throw new BadRequestException("INVALID_WEBHOOK", "Provider and event id are required");
        }
        if (webhookEventRepository.existsByProviderAndEventId(provider, eventId)) {
            return false;
        }
        WebhookEvent event = new WebhookEvent();
        event.setProvider(provider);
        event.setEventId(eventId);
        event.setPayload(toMap(payload));
        event.setSignatureValid(signatureValid);
        event.setStatus(WebhookStatus.RECEIVED);
        webhookEventRepository.save(event);
        return true;
    }

    @Transactional
    public void applyStatus(String provider,
                            String providerEventId,
                            String providerMessageId,
                            String eventType,
                            Instant occurredAt,
                            Map<String, Object> payload) {
        if (provider == null || provider.isBlank() || providerMessageId == null || providerMessageId.isBlank()) {
            log.warn("Ignoring webhook event without provider/providerMessageId");
            return;
        }
        if (providerEventId != null && !providerEventId.isBlank()
                && messageEventRepository.existsByProviderAndProviderEventId(provider, providerEventId)) {
            log.debug("Duplicate provider event {} ignored", providerEventId);
            return;
        }

        Message message = messageRepository
                .findByProviderAndProviderMessageId(provider, providerMessageId)
                .orElse(null);
        if (message == null) {
            log.warn("No message for provider {} message id {}", provider, providerMessageId);
            return;
        }

        Instant eventTime = occurredAt == null ? Instant.now() : occurredAt;
        Map<String, Object> eventPayload = payload == null ? Map.of() : payload;
        MessageStatus target = mapStatus(eventType);

        if (target != null && MessageStatusMachine.canTransition(message.getStatus(), target)) {
            applyTransition(message, target, eventTime, eventPayload);
            messageRepository.save(message);
            updateRecipientStatus(message.getId(), target);
            if (isFailure(target) && message.getChannel() == Channel.EMAIL
                    && message.getToAddress() != null && !message.getToAddress().isBlank()) {
                suppressEmail(message);
            }
        } else if (target != null) {
            log.debug("Ignoring illegal transition {} -> {} for message {}",
                    message.getStatus(), target, message.getId());
        }

        MessageEvent event = new MessageEvent();
        event.setOrganizationId(message.getOrganizationId());
        event.setMessageId(message.getId());
        event.setProvider(provider);
        event.setProviderEventId(providerEventId);
        event.setEventType(eventType == null ? "UNKNOWN" : eventType);
        event.setEventTime(eventTime);
        event.setPayload(eventPayload);
        event.setProcessedAt(Instant.now());
        messageEventRepository.save(event);

        if (providerEventId != null && !providerEventId.isBlank()) {
            webhookEventRepository.findByProviderAndEventId(provider, providerEventId).ifPresent(webhook -> {
                webhook.setStatus(WebhookStatus.PROCESSED);
                webhook.setProcessedAt(Instant.now());
                webhookEventRepository.save(webhook);
            });
        }
    }

    private void applyTransition(Message message,
                                 MessageStatus target,
                                 Instant eventTime,
                                 Map<String, Object> payload) {
        message.setStatus(target);
        switch (target) {
            case DELIVERED -> message.setDeliveredAt(eventTime);
            case READ -> message.setReadAt(eventTime);
            case FAILED, BOUNCED, REJECTED, UNDELIVERABLE -> {
                message.setFailedAt(eventTime);
                message.setErrorCode(firstString(payload, "errorCode", "error_code", "code"));
                message.setErrorMessage(firstString(payload, "errorMessage", "error_message", "message", "reason"));
            }
            default -> {
                // SENT and other targets need no extra timestamp.
            }
        }
    }

    private void updateRecipientStatus(UUID messageId, MessageStatus target) {
        String recipientStatus = switch (target) {
            case SENT -> "SENT";
            case DELIVERED, READ -> "DELIVERED";
            case FAILED, BOUNCED, REJECTED, UNDELIVERABLE -> "FAILED";
            default -> null;
        };
        if (recipientStatus != null) {
            jdbcTemplate.update(
                    "update campaign_recipients set status = ?, updated_at = now() where message_id = ?",
                    recipientStatus, messageId);
        }
    }

    private void suppressEmail(Message message) {
        jdbcTemplate.update("""
                        insert into suppression_records (organization_id, channel, email, reason)
                        values (?, 'EMAIL', lower(?), 'HARD_BOUNCE')
                        on conflict do nothing
                        """,
                message.getOrganizationId(), message.getToAddress());
    }

    private Map<String, Object> toMap(Object payload) {
        if (payload == null) {
            return Map.of();
        }
        if (payload instanceof Map<?, ?> map) {
            Map<String, Object> result = new LinkedHashMap<>();
            map.forEach((key, value) -> result.put(String.valueOf(key), value));
            return result;
        }
        try {
            return objectMapper.convertValue(payload, new TypeReference<Map<String, Object>>() {
            });
        } catch (IllegalArgumentException ex) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("value", payload);
            return result;
        }
    }

    private static MessageStatus mapStatus(String eventType) {
        if (eventType == null) {
            return null;
        }
        return switch (eventType.toUpperCase(Locale.ROOT)) {
            case "SENT" -> MessageStatus.SENT;
            case "DELIVERED" -> MessageStatus.DELIVERED;
            case "READ", "OPENED", "CLICKED" -> MessageStatus.READ;
            case "FAILED" -> MessageStatus.FAILED;
            case "BOUNCED" -> MessageStatus.BOUNCED;
            case "REJECTED" -> MessageStatus.REJECTED;
            case "UNDELIVERABLE" -> MessageStatus.UNDELIVERABLE;
            default -> null;
        };
    }

    private static boolean isFailure(MessageStatus status) {
        return status == MessageStatus.FAILED
                || status == MessageStatus.BOUNCED
                || status == MessageStatus.REJECTED
                || status == MessageStatus.UNDELIVERABLE;
    }

    private static String firstString(Map<String, Object> payload, String... keys) {
        for (String key : keys) {
            Object value = payload.get(key);
            if (value != null) {
                return value.toString();
            }
        }
        return null;
    }
}
