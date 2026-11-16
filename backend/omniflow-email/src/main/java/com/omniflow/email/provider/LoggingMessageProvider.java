package com.omniflow.email.provider;

import com.omniflow.messaging.provider.MessageProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Safe development fallback: logs the outbound message and always succeeds.
 * Registered under the {@code LOG} provider code and usable for any channel.
 */
@Component
public class LoggingMessageProvider implements MessageProvider {

    private static final Logger log = LoggerFactory.getLogger(LoggingMessageProvider.class);

    @Override
    public String providerCode() {
        return "LOG";
    }

    @Override
    public SendResult send(SendRequest request) {
        String messageId = request.messageId() != null
                ? request.messageId().toString()
                : UUID.randomUUID().toString();
        log.info("[LOG PROVIDER] channel={} to={} subject={} messageId={}",
                request.channel(),
                mask(request.to()),
                abbreviate(request.subject()),
                messageId);
        return SendResult.success("log-" + messageId, Map.of("logged", true));
    }

    private static String mask(String value) {
        if (value == null || value.isBlank()) {
            return "<none>";
        }
        String trimmed = value.trim();
        if (trimmed.length() <= 4) {
            return "***";
        }
        return trimmed.charAt(0) + "***" + trimmed.charAt(trimmed.length() - 1);
    }

    private static String abbreviate(String value) {
        if (value == null) {
            return "<none>";
        }
        return value.length() <= 80 ? value : value.substring(0, 80) + "...";
    }
}
