package com.omniflow.messaging.provider;

import com.omniflow.common.domain.enums.Channel;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Adapter contract implemented by the email, WhatsApp and SMS modules.
 */
public interface MessageProvider {

    /**
     * Canonical provider code stored on provider_accounts.provider, e.g. SMTP, META_CLOUD.
     */
    String providerCode();

    /**
     * Optional alternative codes (e.g. SES -> SMTP implementation).
     */
    default List<String> aliases() {
        return List.of();
    }

    SendResult send(SendRequest request);

    record SendRequest(
            UUID organizationId,
            UUID messageId,
            Channel channel,
            String to,
            String from,
            String fromName,
            String subject,
            String body,
            String htmlBody,
            Map<String, String> credentials,
            Map<String, Object> config,
            String idempotencyKey,
            Map<String, Object> metadata
    ) {
    }

    record SendResult(boolean success,
                      String providerMessageId,
                      String errorCode,
                      String errorMessage,
                      Map<String, Object> raw) {

        public static SendResult success(String providerMessageId, Map<String, Object> raw) {
            return new SendResult(true, providerMessageId, null, null, raw);
        }

        public static SendResult failure(String errorCode, String errorMessage, Map<String, Object> raw) {
            return new SendResult(false, null, errorCode, errorMessage, raw);
        }
    }
}
