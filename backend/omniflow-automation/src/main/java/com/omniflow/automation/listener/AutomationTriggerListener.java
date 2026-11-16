package com.omniflow.automation.listener;

import com.omniflow.automation.domain.Workflow;
import com.omniflow.automation.repository.WorkflowRepository;
import com.omniflow.automation.service.AutomationEngine;
import com.omniflow.common.config.MessagingTopology;
import com.omniflow.common.domain.enums.WorkflowStatus;
import com.omniflow.common.domain.enums.WorkflowTriggerType;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Worker-side entry point for automation triggers. Contact-created events fan out to every
 * ACTIVE workflow with the CONTACT_CREATED trigger; the explicit trigger queue is used for
 * manual/segment/webhook triggers.
 */
@Component
@Profile("worker")
@RequiredArgsConstructor
public class AutomationTriggerListener {

    private static final Logger log = LoggerFactory.getLogger(AutomationTriggerListener.class);

    private final WorkflowRepository workflowRepository;
    private final AutomationEngine automationEngine;
    private final JdbcTemplate jdbcTemplate;

    @RabbitListener(queues = MessagingTopology.Q_AUTOMATION_CONTACT_CREATED)
    public void onContactCreated(Map<String, Object> envelope) {
        Map<String, Object> payload = payload(envelope);
        UUID organizationId = firstUuid(payload.get("organizationId"), envelope.get("organizationId"));
        UUID contactId = uuid(payload.get("contactId"));
        if (organizationId == null || contactId == null) {
            log.warn("Ignoring contact.created event without organizationId/contactId");
            return;
        }
        for (Workflow workflow : workflowRepository
                .findByOrganizationIdAndStatusAndTriggerTypeAndDeletedAtIsNull(
                        organizationId, WorkflowStatus.ACTIVE, WorkflowTriggerType.CONTACT_CREATED)) {
            if (!matchesTagFilter(organizationId, contactId, workflow)) {
                continue;
            }
            try {
                automationEngine.startExecution(organizationId, workflow.getId(), contactId, payload);
            } catch (RuntimeException ex) {
                log.warn("Failed to start workflow {} for contact {}: {}",
                        workflow.getId(), contactId, ex.getMessage());
            }
        }
    }

    @RabbitListener(queues = MessagingTopology.Q_AUTOMATION_TRIGGER)
    public void onTrigger(Map<String, Object> envelope) {
        Map<String, Object> payload = payload(envelope);
        UUID organizationId = firstUuid(payload.get("organizationId"), envelope.get("organizationId"));
        UUID workflowId = firstUuid(payload.get("workflowId"), envelope.get("aggregateId"));
        UUID contactId = uuid(payload.get("contactId"));
        if (organizationId == null || workflowId == null || contactId == null) {
            log.warn("Ignoring automation.trigger event without workflowId/contactId/organizationId");
            return;
        }
        try {
            automationEngine.startExecution(organizationId, workflowId, contactId, payload);
        } catch (RuntimeException ex) {
            log.warn("Failed to run explicit workflow trigger {} for contact {}: {}",
                    workflowId, contactId, ex.getMessage());
        }
    }

    private boolean matchesTagFilter(UUID organizationId, UUID contactId, Workflow workflow) {
        Map<String, Object> config = workflow.getTriggerConfig();
        if (config == null) {
            return true;
        }
        Object raw = config.get("tagName");
        if (raw == null || raw.toString().isBlank()) {
            return true;
        }
        try {
            Long count = jdbcTemplate.queryForObject("""
                    select count(*)
                    from contact_tags ct
                    join tags t on t.id = ct.tag_id
                    where ct.contact_id = ? and t.organization_id = ? and lower(t.name) = ?
                    """, Long.class, contactId, organizationId, raw.toString().trim().toLowerCase(Locale.ROOT));
            return count != null && count > 0;
        } catch (RuntimeException ex) {
            // Tag tables are owned by CRM; if the lookup fails we prefer running the workflow.
            log.debug("Tag filter lookup failed: {}", ex.getMessage());
            return true;
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> payload(Map<String, Object> envelope) {
        if (envelope == null) {
            return new LinkedHashMap<>();
        }
        Object raw = envelope.get("payload");
        if (raw instanceof Map<?, ?> map) {
            Map<String, Object> result = new LinkedHashMap<>();
            map.forEach((key, value) -> {
                if (key != null) {
                    result.put(String.valueOf(key), value);
                }
            });
            return result;
        }
        return new LinkedHashMap<>();
    }

    private static UUID firstUuid(Object primary, Object fallback) {
        UUID value = uuid(primary);
        return value != null ? value : uuid(fallback);
    }

    private static UUID uuid(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return UUID.fromString(value.toString());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
