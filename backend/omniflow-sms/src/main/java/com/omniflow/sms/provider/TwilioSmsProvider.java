package com.omniflow.sms.provider;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omniflow.messaging.provider.MessageProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.Map;
import java.util.UUID;

/**
 * Twilio programmable SMS adapter (form-encoded Messages API, HTTP Basic auth).
 */
@Component
public class TwilioSmsProvider implements MessageProvider {

    private static final Logger log = LoggerFactory.getLogger(TwilioSmsProvider.class);

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public TwilioSmsProvider() {
        this.restClient = RestClient.create();
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public String providerCode() {
        return "TWILIO";
    }

    @Override
    public SendResult send(SendRequest request) {
        Map<String, String> credentials = request.credentials() == null ? Map.of() : request.credentials();
        Map<String, Object> config = request.config() == null ? Map.of() : request.config();

        String accountSid = firstNonBlank(credentials.get("accountSid"), credentials.get("account_sid"));
        String authToken = firstNonBlank(credentials.get("authToken"), credentials.get("auth_token"));
        String from = firstNonBlank(
                request.from(),
                asString(config.get("fromNumber")),
                asString(config.get("from")),
                asString(config.get("senderId")));

        if (accountSid == null || authToken == null) {
            return SendResult.failure("SMS_SEND_FAILED", "Missing Twilio account credentials", Map.of());
        }
        if (request.to() == null || request.to().isBlank()) {
            return SendResult.failure("SMS_SEND_FAILED", "Recipient number is required", Map.of());
        }
        if (from == null) {
            return SendResult.failure("SMS_SEND_FAILED", "Missing Twilio sender number", Map.of());
        }

        String url = "https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/Messages.json";
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("To", request.to());
        form.add("From", from);
        form.add("Body", request.body() == null ? "" : request.body());

        try {
            ResponseEntity<String> response = restClient.post()
                    .uri(url)
                    .headers(headers -> headers.setBasicAuth(accountSid, authToken))
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .toEntity(String.class);

            Map<String, Object> raw = parse(response.getBody());
            if (response.getStatusCode().is2xxSuccessful()) {
                String sid = firstNonBlank(
                        asString(raw.get("sid")),
                        request.messageId() == null ? null : request.messageId().toString());
                if (sid == null) {
                    sid = "twilio-" + UUID.randomUUID();
                }
                return SendResult.success(sid, raw);
            }
            return SendResult.failure(
                    "SMS_SEND_FAILED",
                    "Unexpected status " + response.getStatusCode().value(),
                    raw);
        } catch (RestClientResponseException e) {
            log.warn("Twilio send failed for messageId={} status={}",
                    request.messageId(), e.getStatusCode().value());
            String message = firstNonBlank(e.getResponseBodyAsString(), e.getMessage(), "Twilio send failed");
            return SendResult.failure("SMS_SEND_FAILED", message, parse(e.getResponseBodyAsString()));
        } catch (Exception e) {
            log.warn("Twilio send failed for messageId={}: {}", request.messageId(), safeMessage(e));
            return SendResult.failure("SMS_SEND_FAILED", safeMessage(e), Map.of());
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
            log.debug("Could not parse Twilio response JSON: {}", e.getMessage());
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
