package com.omniflow.sms.webhook;

import com.omniflow.common.api.ApiResponse;
import com.omniflow.messaging.service.MessageWebhookService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Public SMS delivery-receipt callback shared by Twilio and generic/DLT gateways.
 */
@RestController
@RequestMapping("/api/v1/webhooks/sms")
public class SmsWebhookController {

    private static final Logger log = LoggerFactory.getLogger(SmsWebhookController.class);

    private static final long MILLIS_THRESHOLD = 100_000_000_000L;

    private final MessageWebhookService messageWebhookService;

    public SmsWebhookController(MessageWebhookService messageWebhookService) {
        this.messageWebhookService = messageWebhookService;
    }

    @PostMapping("/{provider}")
    public ApiResponse<Map<String, Object>> receive(
            @PathVariable("provider") String provider,
            @RequestParam(name = "accountId", required = false) String accountId,
            @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = body == null ? Map.of() : body;
        String providerCode = normalizeProvider(provider);

        try {
            String status = normalizeStatus(firstNonBlank(
                    string(payload.get("status")),
                    string(payload.get("eventType"))));
            String providerMessageId = firstNonBlank(
                    string(payload.get("messageId")),
                    string(payload.get("providerMessageId")),
                    string(payload.get("sid")),
                    string(payload.get("id")));
            String baseEventId = firstNonBlank(
                    string(payload.get("eventId")),
                    string(payload.get("id")),
                    providerMessageId);
            String eventId = baseEventId == null
                    ? UUID.randomUUID().toString()
                    : (status == null ? baseEventId : baseEventId + "-" + status);
            Instant occurredAt = parseInstant(firstNonNull(
                    payload.get("timestamp"),
                    payload.get("eventTime"),
                    payload.get("dateCreated")));

            log.debug("SMS webhook provider={} accountId={} eventId={}", providerCode, accountId, eventId);
            messageWebhookService.recordRawWebhook(providerCode, eventId, payload, false);
            messageWebhookService.applyStatus(
                    providerCode,
                    eventId,
                    providerMessageId,
                    status == null ? "UNKNOWN" : status,
                    occurredAt,
                    payload);
        } catch (Exception e) {
            log.warn("Failed to process SMS webhook for provider={}: {}", providerCode, e.getMessage(), e);
        }

        return ApiResponse.ok(Map.of("status", "received"));
    }

    @GetMapping("/{provider}/health")
    public ApiResponse<Map<String, Object>> health(@PathVariable("provider") String provider) {
        return ApiResponse.ok(Map.of("status", "up", "provider", normalizeProvider(provider)));
    }

    private static String normalizeProvider(String provider) {
        if (provider == null || provider.isBlank()) {
            return "UNKNOWN";
        }
        String lowered = provider.trim().toLowerCase(Locale.ROOT);
        return switch (lowered) {
            case "twilio" -> "TWILIO";
            case "generic" -> "GENERIC_HTTP";
            default -> lowered.toUpperCase(Locale.ROOT);
        };
    }

    private static String normalizeStatus(String status) {
        return status == null ? null : status.trim().toUpperCase(Locale.ROOT);
    }

    private static Instant parseInstant(Object value) {
        if (value == null) {
            return Instant.now();
        }
        if (value instanceof Number number) {
            return fromEpoch(number.longValue());
        }
        String text = value.toString().trim();
        if (text.isEmpty()) {
            return Instant.now();
        }
        try {
            return fromEpoch(Long.parseLong(text));
        } catch (NumberFormatException ignored) {
            // fall through to ISO parsing
        }
        try {
            return Instant.parse(text);
        } catch (DateTimeParseException ignored) {
            // fall through to offset parsing
        }
        try {
            return OffsetDateTime.parse(text).toInstant();
        } catch (DateTimeParseException ignored) {
            return Instant.now();
        }
    }

    private static Instant fromEpoch(long value) {
        return value > MILLIS_THRESHOLD ? Instant.ofEpochMilli(value) : Instant.ofEpochSecond(value);
    }

    private static Object firstNonNull(Object... values) {
        if (values == null) {
            return null;
        }
        for (Object value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
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

    private static String string(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
