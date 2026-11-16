package com.omniflow.whatsapp.webhook;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.port.InboxPort;
import com.omniflow.common.port.InboundMessage;
import com.omniflow.common.port.ProviderAccountInfo;
import com.omniflow.common.port.ProviderAccountResolver;
import com.omniflow.messaging.service.MessageWebhookService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Meta WhatsApp Cloud API callback: GET verifies the subscription, POST receives
 * delivery statuses and inbound messages. Public by design, no tenant guard.
 */
@RestController
@RequestMapping("/api/v1/webhooks/whatsapp")
public class WhatsAppWebhookController {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppWebhookController.class);

    private static final String PROVIDER = "META_CLOUD";

    private final MessageWebhookService messageWebhookService;
    private final ProviderAccountResolver providerAccountResolver;
    private final InboxPort inboxPort;
    private final ObjectMapper objectMapper;
    private final String verifyToken;
    private final String appSecret;

    public WhatsAppWebhookController(
            MessageWebhookService messageWebhookService,
            ProviderAccountResolver providerAccountResolver,
            InboxPort inboxPort,
            ObjectMapper objectMapper,
            @Value("${omniflow.whatsapp.verify-token:}") String verifyToken,
            @Value("${omniflow.whatsapp.app-secret:}") String appSecret) {
        this.messageWebhookService = messageWebhookService;
        this.providerAccountResolver = providerAccountResolver;
        this.inboxPort = inboxPort;
        this.objectMapper = objectMapper;
        this.verifyToken = verifyToken;
        this.appSecret = appSecret;
    }

    @GetMapping
    public ResponseEntity<String> verify(
            @RequestParam(name = "hub.mode", required = false) String mode,
            @RequestParam(name = "hub.verify_token", required = false) String token,
            @RequestParam(name = "hub.challenge", required = false) String challenge) {
        if ("subscribe".equals(mode)
                && verifyToken != null && !verifyToken.isBlank()
                && constantTimeEquals(token, verifyToken)) {
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(challenge == null ? "" : challenge);
        }
        log.info("Rejected WhatsApp webhook verification (mode={})", mode);
        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }

    @PostMapping
    public ResponseEntity<String> receive(
            @RequestBody(required = false) String rawBody,
            @RequestHeader(name = "X-Hub-Signature-256", required = false) String signature,
            @RequestParam(name = "accountId", required = false) String accountId) {
        if (!isSignatureValid(rawBody, signature)) {
            log.warn("Rejected WhatsApp webhook with invalid X-Hub-Signature-256");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("INVALID_SIGNATURE");
        }

        try {
            Map<String, Object> payload = parse(rawBody);
            processEntries(payload, accountId, true);
        } catch (Exception e) {
            log.warn("Failed to process WhatsApp webhook: {}", e.getMessage(), e);
        }

        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .body("EVENT_RECEIVED");
    }

    private void processEntries(Map<String, Object> payload, String accountId, boolean signatureValid) {
        for (Object entryObject : asList(payload.get("entry"))) {
            Map<String, Object> entry = asMap(entryObject);
            for (Object changeObject : asList(entry.get("changes"))) {
                try {
                    Map<String, Object> change = asMap(changeObject);
                    Map<String, Object> value = asMap(change.get("value"));
                    handleStatuses(value, signatureValid);
                    handleInbound(value, accountId);
                } catch (Exception e) {
                    log.warn("Failed to handle WhatsApp change entry: {}", e.getMessage(), e);
                }
            }
        }
    }

    private void handleStatuses(Map<String, Object> value, boolean signatureValid) {
        for (Object statusObject : asList(value.get("statuses"))) {
            try {
                Map<String, Object> status = asMap(statusObject);
                String providerMessageId = string(status.get("id"));
                String statusText = string(status.get("status"));
                String eventType = statusText == null ? "UNKNOWN" : statusText.toUpperCase(Locale.ROOT);
                Instant occurredAt = toInstant(status.get("timestamp"));
                String eventId = providerMessageId + "-" + statusText + "-" + occurredAt.getEpochSecond();

                messageWebhookService.recordRawWebhook(PROVIDER, eventId, status, signatureValid);
                messageWebhookService.applyStatus(
                        PROVIDER,
                        eventId,
                        providerMessageId,
                        eventType,
                        occurredAt,
                        status);
            } catch (Exception e) {
                log.warn("Failed to handle WhatsApp status callback: {}", e.getMessage(), e);
            }
        }
    }

    private void handleInbound(Map<String, Object> value, String accountId) {
        List<?> messages = asList(value.get("messages"));
        if (messages.isEmpty()) {
            return;
        }
        Map<String, Object> metadata = asMap(value.get("metadata"));
        String phoneNumberId = string(metadata.get("phone_number_id"));

        ProviderAccountInfo account = resolveByPhoneNumberId(phoneNumberId);
        if (account == null) {
            account = resolveAccount(accountId);
        }
        if (account == null) {
            log.info("WhatsApp inbound received without a resolvable provider account (phoneNumberId={}, accountId={}); skipping",
                    phoneNumberId, accountId);
            return;
        }

        String toAddress = firstNonBlank(account.fromAddress(), phoneNumberId);

        for (Object messageObject : messages) {
            try {
                Map<String, Object> message = asMap(messageObject);
                String from = string(message.get("from"));
                String providerMessageId = string(message.get("id"));
                String text = extractText(message);
                Instant occurredAt = toInstant(message.get("timestamp"));

                inboxPort.handleInbound(new InboundMessage(
                        account.organizationId(),
                        account.id(),
                        Channel.WHATSAPP,
                        from,
                        toAddress,
                        providerMessageId,
                        null,
                        text == null ? "" : text,
                        message,
                        occurredAt));
            } catch (Exception e) {
                log.warn("Failed to handle WhatsApp inbound message: {}", e.getMessage(), e);
            }
        }
    }

    private ProviderAccountInfo resolveByPhoneNumberId(String phoneNumberId) {
        if (phoneNumberId == null || phoneNumberId.isBlank()) {
            return null;
        }
        try {
            return providerAccountResolver.findByWhatsAppPhoneNumberId(phoneNumberId.trim()).orElse(null);
        } catch (Exception e) {
            log.warn("Failed to resolve WhatsApp account for phoneNumberId '{}': {}", phoneNumberId, e.getMessage());
            return null;
        }
    }

    private ProviderAccountInfo resolveAccount(String accountId) {
        if (accountId == null || accountId.isBlank()) {
            return null;
        }
        try {
            return providerAccountResolver.findById(UUID.fromString(accountId.trim())).orElse(null);
        } catch (Exception e) {
            log.warn("Invalid WhatsApp accountId '{}': {}", accountId, e.getMessage());
            return null;
        }
    }

    private boolean isSignatureValid(String rawBody, String signatureHeader) {
        if (appSecret == null || appSecret.isBlank()) {
            return true;
        }
        if (rawBody == null || signatureHeader == null || signatureHeader.isBlank()) {
            return false;
        }
        String provided = signatureHeader.startsWith("sha256=")
                ? signatureHeader.substring("sha256=".length())
                : signatureHeader;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String expected = HexFormat.of().formatHex(mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8)));
            return MessageDigest.isEqual(
                    expected.getBytes(StandardCharsets.US_ASCII),
                    provided.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII));
        } catch (Exception e) {
            log.warn("Failed to verify WhatsApp webhook signature: {}", e.getMessage());
            return false;
        }
    }

    private Map<String, Object> parse(String rawBody) {
        if (rawBody == null || rawBody.isBlank()) {
            return Map.of();
        }
        try {
            Map<String, Object> parsed = objectMapper.readValue(
                    rawBody, new TypeReference<Map<String, Object>>() {
                    });
            return parsed == null ? Map.of() : parsed;
        } catch (Exception e) {
            log.warn("WhatsApp webhook body was not valid JSON: {}", e.getMessage());
            return Map.of();
        }
    }

    private static String extractText(Map<String, Object> message) {
        String type = string(message.get("type"));
        if (type == null) {
            return null;
        }
        return switch (type.toLowerCase(Locale.ROOT)) {
            case "text" -> string(asMap(message.get("text")).get("body"));
            case "button" -> string(asMap(message.get("button")).get("text"));
            case "interactive" -> {
                Map<String, Object> interactive = asMap(message.get("interactive"));
                String buttonTitle = string(asMap(interactive.get("button_reply")).get("title"));
                yield buttonTitle != null
                        ? buttonTitle
                        : string(asMap(interactive.get("list_reply")).get("title"));
            }
            case "image", "video", "document" -> string(asMap(message.get(type)).get("caption"));
            default -> null;
        };
    }

    private static Instant toInstant(Object value) {
        if (value instanceof Number number) {
            return Instant.ofEpochSecond(number.longValue());
        }
        String text = value == null ? null : value.toString().trim();
        if (text == null || text.isEmpty()) {
            return Instant.now();
        }
        try {
            return Instant.ofEpochSecond(Long.parseLong(text));
        } catch (NumberFormatException ignored) {
            // fall through to ISO parsing
        }
        try {
            return Instant.parse(text);
        } catch (DateTimeParseException ignored) {
            return Instant.now();
        }
    }

    private static boolean constantTimeEquals(String left, String right) {
        if (left == null || right == null) {
            return false;
        }
        return MessageDigest.isEqual(
                left.getBytes(StandardCharsets.UTF_8),
                right.getBytes(StandardCharsets.UTF_8));
    }

    private static List<?> asList(Object value) {
        return value instanceof List<?> list ? list : List.of();
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
}
