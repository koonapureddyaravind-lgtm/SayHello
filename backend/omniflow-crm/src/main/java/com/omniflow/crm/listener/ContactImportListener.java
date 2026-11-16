package com.omniflow.crm.listener;

import com.omniflow.common.config.MessagingTopology;
import com.omniflow.crm.service.ContactImportProcessor;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Worker-only consumer for contact.import.requested outbox events.
 */
@Component
@Profile("worker")
@RequiredArgsConstructor
public class ContactImportListener {

    private static final Logger log = LoggerFactory.getLogger(ContactImportListener.class);

    private final ContactImportProcessor importProcessor;

    @RabbitListener(queues = MessagingTopology.Q_CONTACT_IMPORT)
    public void onEnvelope(Map<String, Object> envelope) {
        UUID importId;
        UUID organizationId;
        try {
            Map<?, ?> payload = payload(envelope);
            importId = uuid(payload.get("importId"));
            organizationId = uuid(payload.get("organizationId"));
        } catch (IllegalArgumentException ex) {
            log.warn("Dropping malformed contact.import.requested envelope: {}", ex.getMessage());
            return;
        }
        if (importId == null || organizationId == null) {
            log.warn("Dropping contact.import.requested envelope without importId/organizationId");
            return;
        }
        importProcessor.process(organizationId, importId);
    }

    private static Map<?, ?> payload(Map<String, Object> envelope) {
        Object payload = envelope == null ? null : envelope.get("payload");
        if (!(payload instanceof Map<?, ?> map)) {
            throw new IllegalArgumentException("missing payload object");
        }
        return map;
    }

    private static UUID uuid(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return UUID.fromString(value.toString());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("invalid uuid: " + value, ex);
        }
    }
}
