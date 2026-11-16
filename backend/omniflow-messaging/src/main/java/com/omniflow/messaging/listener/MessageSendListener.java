package com.omniflow.messaging.listener;

import com.omniflow.common.config.MessagingTopology;
import com.omniflow.messaging.service.MessageSendService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Worker-only consumer for message.send outbox events.
 */
@Component
@Profile("worker")
@RequiredArgsConstructor
public class MessageSendListener {

    private static final Logger log = LoggerFactory.getLogger(MessageSendListener.class);

    private final MessageSendService messageSendService;

    @RabbitListener(queues = MessagingTopology.Q_MESSAGE_SEND)
    public void onEnvelope(Map<String, Object> envelope) {
        UUID messageId;
        try {
            messageId = extractMessageId(envelope);
        } catch (IllegalArgumentException ex) {
            log.warn("Dropping malformed message.send envelope: {}", ex.getMessage());
            return;
        }
        if (messageId == null) {
            log.warn("Dropping message.send envelope without messageId");
            return;
        }

        try {
            messageSendService.send(messageId);
        } catch (IllegalArgumentException ex) {
            log.warn("Dropping invalid message.send for {}: {}", messageId, ex.getMessage());
        } catch (RuntimeException ex) {
            log.error("Message send failed for {}", messageId, ex);
            // Rethrow so the broker retries with its configured backoff / dead-letters it.
            throw ex;
        }
    }

    private static UUID extractMessageId(Map<String, Object> envelope) {
        Object payload = envelope == null ? null : envelope.get("payload");
        if (!(payload instanceof Map<?, ?> map)) {
            throw new IllegalArgumentException("missing payload object");
        }
        Object value = map.get("messageId");
        if (value == null) {
            return null;
        }
        try {
            return UUID.fromString(value.toString());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("invalid messageId: " + value, ex);
        }
    }
}
