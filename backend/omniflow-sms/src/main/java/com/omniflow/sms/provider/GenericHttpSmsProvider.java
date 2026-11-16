package com.omniflow.sms.provider;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omniflow.messaging.provider.MessageProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Generic JSON-over-HTTP SMS adapter used for DLT gateways and Plivo-style APIs.
 */
@Component
public class GenericHttpSmsProvider implements MessageProvider {

    private static final Logger log = LoggerFactory.getLogger(GenericHttpSmsProvider.class);

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public GenericHttpSmsProvider() {
        this.restClient = RestClient.create();
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public String providerCode() {
        return "GENERIC_HTTP";
    }

    @Override
    public List<String> aliases() {
        return List.of("PLIVO", "DLT");
    }

    @Override
    public SendResult send(SendRequest request) {
        Map<String, String> credentials = request.credentials() == null ? Map.of() : request.credentials();
        Map<String, Object> config = request.config() == null ? Map.of() : request.config();

        String url = asString(config.get("url"));
        if (url == null || url.isBlank()) {
            return SendResult.failure("SMS_SEND_FAILED", "Missing generic SMS provider url", Map.of());
        }
        if (request.to() == null || request.to().isBlank()) {
            return SendResult.failure("SMS_SEND_FAILED", "Recipient number is required", Map.of());
        }

        String senderId = asString(config.get("senderId"));
        String from = firstNonBlank(request.from(), senderId, asString(config.get("from")));
        String apiKey = firstNonBlank(credentials.get("apiKey"), credentials.get("api_key"));
        String authHeader = firstNonBlank(asString(config.get("authHeader")), "Authorization");
        String authScheme = asString(config.get("authScheme"));
        if (authScheme == null) {
            authScheme = "Bearer";
        }
        HttpMethod method = resolveMethod(config);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("to", request.to());
        payload.put("from", from);
        payload.put("senderId", senderId);
        payload.put("message", request.body() == null ? "" : request.body());
        payload.put("reference", request.idempotencyKey());

        try {
            String headerValue = apiKey == null
                    ? null
                    : (authScheme.isBlank() ? apiKey : authScheme + " " + apiKey);
            String headerName = authHeader;

            ResponseEntity<String> response = restClient.method(method)
                    .uri(url.trim())
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(headers -> {
                        if (headerValue != null) {
                            headers.set(headerName, headerValue);
                        }
                    })
                    .body(payload)
                    .retrieve()
                    .toEntity(String.class);

            Map<String, Object> raw = parse(response.getBody());
            if (response.getStatusCode().is2xxSuccessful()) {
                String providerMessageId = firstNonBlank(
                        asString(raw.get("messageId")),
                        asString(raw.get("id")),
                        asString(raw.get("requestId")),
                        request.messageId() == null ? null : request.messageId().toString());
                if (providerMessageId == null) {
                    providerMessageId = "sms-" + UUID.randomUUID();
                }
                return SendResult.success(providerMessageId, raw);
            }
            return SendResult.failure(
                    "SMS_SEND_FAILED",
                    "Unexpected status " + response.getStatusCode().value(),
                    raw);
        } catch (RestClientResponseException e) {
            log.warn("Generic SMS send failed for messageId={} status={}",
                    request.messageId(), e.getStatusCode().value());
            String message = firstNonBlank(e.getResponseBodyAsString(), e.getMessage(), "SMS send failed");
            return SendResult.failure("SMS_SEND_FAILED", message, parse(e.getResponseBodyAsString()));
        } catch (Exception e) {
            log.warn("Generic SMS send failed for messageId={}: {}", request.messageId(), safeMessage(e));
            return SendResult.failure("SMS_SEND_FAILED", safeMessage(e), Map.of());
        }
    }

    private HttpMethod resolveMethod(Map<String, Object> config) {
        String raw = firstNonBlank(asString(config.get("method")), "POST").toUpperCase(Locale.ROOT);
        try {
            return HttpMethod.valueOf(raw);
        } catch (IllegalArgumentException e) {
            return HttpMethod.POST;
        }
    }

    private Map<String, Object> parse(String body) {
        if (body == null || body.isBlank()) {
            return Map.of();
        }
        try {
            Map<String, Object> parsed = objectMapper.readValue(
                    body, new TypeReference<Map<String, Object>>() {
                    });
            return parsed == null ? Map.of() : parsed;
        } catch (Exception e) {
            log.debug("Could not parse generic SMS response JSON: {}", e.getMessage());
            return Map.of();
        }
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

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String safeMessage(Throwable throwable) {
        return throwable.getMessage() == null ? throwable.getClass().getSimpleName() : throwable.getMessage();
    }
}
