package com.omniflow.whatsapp.provider;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.port.ProviderAccountInfo;
import com.omniflow.common.port.ProviderConnectivityChecker;
import com.omniflow.messaging.provider.MessageProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Meta WhatsApp Cloud API adapter.
 */
@Component
public class MetaCloudProvider implements MessageProvider, ProviderConnectivityChecker {

    private static final Logger log = LoggerFactory.getLogger(MetaCloudProvider.class);

    private static final String DEFAULT_TEMPLATE_LANGUAGE = "en_US";

    private final String defaultPhoneNumberId;
    private final String defaultAccessToken;
    private final String defaultApiVersion;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public MetaCloudProvider(
            @Value("${omniflow.whatsapp.phone-number-id:}") String defaultPhoneNumberId,
            @Value("${omniflow.whatsapp.access-token:}") String defaultAccessToken,
            @Value("${omniflow.whatsapp.api-version:v21.0}") String defaultApiVersion) {
        this.defaultPhoneNumberId = defaultPhoneNumberId;
        this.defaultAccessToken = defaultAccessToken;
        this.defaultApiVersion = defaultApiVersion;
        this.restClient = RestClient.create();
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public String providerCode() {
        return "META_CLOUD";
    }

    @Override
    public boolean supports(String provider, Channel channel) {
        return channel == Channel.WHATSAPP && "META_CLOUD".equalsIgnoreCase(provider);
    }

    /**
     * Reads the phone number node from the Graph API. This authenticates the
     * access token and proves the phone number id belongs to the app, which is
     * exactly what a campaign send needs.
     */
    @Override
    public Result check(ProviderAccountInfo account) {
        Map<String, String> credentials = account.credentials() == null ? Map.of() : account.credentials();
        Map<String, Object> config = account.config() == null ? Map.of() : account.config();

        String token = firstNonBlank(
                credentials.get("accessToken"),
                credentials.get("access_token"),
                defaultAccessToken);
        String phoneNumberId = firstNonBlank(
                asString(config.get("phoneNumberId")),
                asString(config.get("phone_number_id")),
                defaultPhoneNumberId);
        String apiVersion = firstNonBlank(asString(config.get("apiVersion")), defaultApiVersion);

        if (token == null) {
            return Result.failure("Missing Meta access token");
        }
        if (phoneNumberId == null) {
            return Result.failure("Missing WhatsApp phone number id");
        }

        String url = "https://graph.facebook.com/" + apiVersion + "/" + phoneNumberId
                + "?fields=verified_name,display_phone_number,quality_rating";
        try {
            ResponseEntity<String> response = restClient.get()
                    .uri(url)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                    .retrieve()
                    .toEntity(String.class);
            if (!response.getStatusCode().is2xxSuccessful()) {
                return Result.failure("Meta Graph API returned " + response.getStatusCode().value());
            }
            Map<String, Object> raw = parse(response.getBody());
            String label = firstNonBlank(
                    asString(raw.get("verified_name")),
                    asString(raw.get("display_phone_number")),
                    phoneNumberId);
            return Result.success("WhatsApp Cloud API reachable for " + label);
        } catch (RestClientResponseException e) {
            log.warn("WhatsApp connectivity check rejected: status={}", e.getStatusCode().value());
            String detail = firstNonBlank(
                    extractErrorMessage(parse(e.getResponseBodyAsString())),
                    e.getMessage(),
                    "Meta Graph API rejected the credentials");
            return Result.failure("WhatsApp connectivity check failed: " + detail);
        } catch (Exception e) {
            log.warn("WhatsApp connectivity check failed unexpectedly: {}", safeMessage(e));
            return Result.failure("WhatsApp connectivity check failed: " + safeMessage(e));
        }
    }

    private String extractErrorMessage(Map<String, Object> raw) {
        Object error = raw.get("error");
        if (error instanceof Map<?, ?> errorMap) {
            Object message = errorMap.get("message");
            if (message != null) {
                return String.valueOf(message);
            }
        }
        return null;
    }

    @Override
    public SendResult send(SendRequest request) {
        Map<String, String> credentials = request.credentials() == null ? Map.of() : request.credentials();
        Map<String, Object> config = request.config() == null ? Map.of() : request.config();
        Map<String, Object> metadata = request.metadata() == null ? Map.of() : request.metadata();

        if (request.to() == null || request.to().isBlank()) {
            return SendResult.failure("WHATSAPP_SEND_FAILED", "Recipient phone number is required", Map.of());
        }

        String token = firstNonBlank(
                credentials.get("accessToken"),
                credentials.get("access_token"),
                defaultAccessToken);
        String phoneNumberId = firstNonBlank(
                asString(config.get("phoneNumberId")),
                asString(config.get("phone_number_id")),
                defaultPhoneNumberId);
        String apiVersion = firstNonBlank(asString(config.get("apiVersion")), defaultApiVersion);

        if (token == null) {
            return SendResult.failure("WHATSAPP_SEND_FAILED", "Missing Meta access token", Map.of());
        }
        if (phoneNumberId == null) {
            return SendResult.failure("WHATSAPP_SEND_FAILED", "Missing WhatsApp phone number id", Map.of());
        }

        String url = "https://graph.facebook.com/" + apiVersion + "/" + phoneNumberId + "/messages";
        Map<String, Object> payload = buildPayload(request, config, metadata);
        if (payload == null) {
            return SendResult.failure(
                    "WHATSAPP_SEND_FAILED",
                    "WhatsApp message needs a body, htmlBody or an approved templateName",
                    Map.of());
        }

        try {
            ResponseEntity<String> response = restClient.post()
                    .uri(url)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toEntity(String.class);

            Map<String, Object> raw = parse(response.getBody());
            if (response.getStatusCode().is2xxSuccessful()) {
                String providerMessageId = firstNonBlank(
                        extractProviderMessageId(raw),
                        request.messageId() == null ? null : request.messageId().toString());
                if (providerMessageId == null) {
                    providerMessageId = "wa-" + UUID.randomUUID();
                }
                return SendResult.success(providerMessageId, raw);
            }
            return SendResult.failure(
                    "WHATSAPP_SEND_FAILED",
                    "Unexpected status " + response.getStatusCode().value(),
                    raw);
        } catch (RestClientResponseException e) {
            log.warn("WhatsApp send failed for messageId={} status={}",
                    request.messageId(), e.getStatusCode().value());
            String message = firstNonBlank(e.getResponseBodyAsString(), e.getMessage(), "WhatsApp send failed");
            return SendResult.failure("WHATSAPP_SEND_FAILED", message, parse(e.getResponseBodyAsString()));
        } catch (Exception e) {
            log.warn("WhatsApp send failed for messageId={}: {}", request.messageId(), safeMessage(e));
            return SendResult.failure("WHATSAPP_SEND_FAILED", safeMessage(e), Map.of());
        }
    }

    private Map<String, Object> buildPayload(SendRequest request,
                                            Map<String, Object> config,
                                            Map<String, Object> metadata) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("messaging_product", "whatsapp");
        payload.put("recipient_type", "individual");
        payload.put("to", normalizeRecipient(request.to()));

        String templateName = firstNonBlank(
                asString(config.get("templateName")),
                asString(metadata.get("templateName")));

        if (templateName != null) {
            String language = firstNonBlank(
                    asString(config.get("templateLanguage")),
                    asString(metadata.get("templateLanguage")),
                    DEFAULT_TEMPLATE_LANGUAGE);
            Map<String, Object> template = new LinkedHashMap<>();
            template.put("name", templateName);
            template.put("language", Map.of("code", language));
            List<Object> components = resolveTemplateComponents(config, metadata);
            template.put("components", components == null ? List.of() : components);
            payload.put("type", "template");
            payload.put("template", template);
        } else {
            String text = firstNonBlank(request.body(), request.htmlBody());
            if (text == null || text.isBlank()) {
                return null;
            }
            payload.put("type", "text");
            Map<String, Object> textPayload = new LinkedHashMap<>();
            textPayload.put("preview_url", resolveBoolean(config.get("previewUrl"), false));
            textPayload.put("body", stripHtml(text));
            payload.put("text", textPayload);
        }
        return payload;
    }

    /**
     * Meta template payloads accept a `components` array. Operators can paste the
     * full JSON in `config.templateComponents` or use the shorthand
     * `config.templateParameters` with a JSON array of strings, which is wrapped
     * in the standard body component:
     *
     * <pre>
     * {"templateName":"order_update","templateLanguage":"en_US",
     *  "templateComponents":"[{\"type\":\"body\",\"parameters\":[{\"type\":\"text\",\"text\":\"Ada\"}]}]"}
     * </pre>
     */
    private List<Object> resolveTemplateComponents(Map<String, Object> config, Map<String, Object> metadata) {
        Object raw = config.get("templateComponents");
        if (raw == null) {
            raw = metadata.get("templateComponents");
        }
        if (raw != null) {
            Object parsed = parseJson(raw);
            if (parsed instanceof List<?> list) {
                return List.copyOf(list);
            }
        }

        Object parametersRaw = config.get("templateParameters");
        if (parametersRaw == null) {
            parametersRaw = metadata.get("templateParameters");
        }
        if (parametersRaw == null) {
            return List.of();
        }
        Object parsed = parseJson(parametersRaw);
        if (!(parsed instanceof List<?> values) || values.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> parameters = values.stream()
                .map(value -> Map.<String, Object>of("type", "text", "text", String.valueOf(value)))
                .toList();
        return List.of(Map.of("type", "body", "parameters", parameters));
    }

    private Object parseJson(Object value) {
        if (!(value instanceof String text) || text.isBlank()) {
            return value;
        }
        try {
            return objectMapper.readValue(text, Object.class);
        } catch (Exception e) {
            log.warn("Ignoring invalid WhatsApp template JSON: {}", e.getMessage());
            return null;
        }
    }

    private static boolean resolveBoolean(Object value, boolean fallback) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value == null) {
            return fallback;
        }
        String text = value.toString().trim();
        if ("true".equalsIgnoreCase(text) || "1".equals(text) || "yes".equalsIgnoreCase(text)) {
            return true;
        }
        if ("false".equalsIgnoreCase(text) || "0".equals(text) || "no".equalsIgnoreCase(text)) {
            return false;
        }
        return fallback;
    }

    private String extractProviderMessageId(Map<String, Object> raw) {
        Object messages = raw.get("messages");
        if (messages instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof Map<?, ?> first) {
            Object id = first.get("id");
            if (id != null) {
                return String.valueOf(id);
            }
        }
        return null;
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
            log.debug("Could not parse WhatsApp response JSON: {}", e.getMessage());
            return Map.of();
        }
    }

    private static String normalizeRecipient(String value) {
        String digits = value.replaceAll("[^0-9]", "");
        return digits.isEmpty() ? value.trim() : digits;
    }

    private static String stripHtml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replaceAll("(?s)<[^>]*>", " ")
                .replace("&nbsp;", " ")
                .replaceAll("\\s+", " ")
                .trim();
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
