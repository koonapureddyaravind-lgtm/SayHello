package com.omniflow.email.webhook;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omniflow.common.api.ApiResponse;
import com.omniflow.messaging.service.MessageWebhookService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Public endpoint receiving Amazon SES notifications, either directly or wrapped
 * in an SNS envelope. Always answers 200 so providers do not retry on our errors.
 */
@RestController
@RequestMapping("/api/v1/webhooks/email")
public class EmailWebhookController {

    private static final Logger log = LoggerFactory.getLogger(EmailWebhookController.class);

    private final MessageWebhookService messageWebhookService;
    private final ObjectMapper objectMapper;

    public EmailWebhookController(MessageWebhookService messageWebhookService, ObjectMapper objectMapper) {
        this.messageWebhookService = messageWebhookService;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/ses")
    public ResponseEntity<ApiResponse<Map<String, Object>>> ses(
            @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> envelope = body == null ? Map.of() : body;
        try {
            String snsType = string(envelope.get("Type"));
            if (isSubscriptionConfirmation(snsType)) {
                log.info("Acknowledged SNS {} on SES webhook", snsType);
                return acknowledged(snsType);
            }

            Map<String, Object> payload = unwrap(envelope);
            if (isSubscriptionConfirmation(string(payload.get("Type")))) {
                log.info("Acknowledged SNS {} inside SES notification", payload.get("Type"));
                return acknowledged("SubscriptionConfirmation");
            }

            SesEvent event = extract(payload);
            messageWebhookService.recordRawWebhook("SES", event.eventId(), envelope, false);
            messageWebhookService.applyStatus(
                    "SES",
                    event.eventId(),
                    event.messageId(),
                    event.eventType(),
                    Instant.now(),
                    envelope);
        } catch (Exception e) {
            log.warn("Failed to process SES webhook: {}", e.getMessage(), e);
        }
        return ResponseEntity.ok(ApiResponse.ok(Map.of("status", "received")));
    }

    @GetMapping("/ses/health")
    public ApiResponse<Map<String, Object>> sesHealth() {
        return ApiResponse.ok(Map.of("status", "up"));
    }

    private ResponseEntity<ApiResponse<Map<String, Object>>> acknowledged(String type) {
        return ResponseEntity.ok(ApiResponse.ok(Map.of("status", "acknowledged", "type", type)));
    }

    private boolean isSubscriptionConfirmation(String type) {
        return "SubscriptionConfirmation".equalsIgnoreCase(type)
                || "UnsubscribeConfirmation".equalsIgnoreCase(type);
    }

    /**
     * SNS wraps the SES notification JSON in a string {@code Message} field.
     */
    private Map<String, Object> unwrap(Map<String, Object> body) {
        Object message = body.get("Message");
        if (message instanceof String raw && !raw.isBlank()) {
            try {
                Map<String, Object> parsed = objectMapper.readValue(
                        raw, new TypeReference<Map<String, Object>>() {
                        });
                if (parsed != null) {
                    return parsed;
                }
            } catch (Exception e) {
                log.warn("SES webhook SNS Message was not valid JSON: {}", e.getMessage());
            }
        }
        return body;
    }

    private SesEvent extract(Map<String, Object> payload) {
        Map<String, Object> mail = asMap(payload.get("mail"));
        String messageId = firstNonBlank(
                string(mail.get("messageId")),
                string(payload.get("messageId")));
        String rawType = firstNonBlank(
                string(payload.get("notificationType")),
                string(payload.get("eventType")));
        String eventType = mapEventType(rawType);
        String eventId = firstNonBlank(string(payload.get("eventId")), messageId);
        if (eventId == null) {
            eventId = UUID.randomUUID().toString();
        }
        return new SesEvent(eventId, messageId, eventType);
    }

    private static String mapEventType(String raw) {
        if (raw == null) {
            return "UNKNOWN";
        }
        return switch (raw.toLowerCase(Locale.ROOT)) {
            case "delivery" -> "DELIVERED";
            case "bounce" -> "BOUNCED";
            case "complaint" -> "FAILED";
            case "open", "click" -> "READ";
            case "send" -> "SENT";
            default -> raw.trim().toUpperCase(Locale.ROOT);
        };
    }

    private static Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> typed = (Map<String, Object>) map;
            return typed;
        }
        return Map.of();
    }

    private static String string(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private record SesEvent(String eventId, String messageId, String eventType) {
    }
}
