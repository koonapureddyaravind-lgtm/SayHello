package com.omniflow.campaign.listener;

import com.omniflow.campaign.service.CampaignLaunchProcessor;
import com.omniflow.common.config.MessagingTopology;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Worker-only consumer for campaign.launch outbox events.
 */
@Component
@Profile("worker")
@RequiredArgsConstructor
public class CampaignLaunchListener {

    private static final Logger log = LoggerFactory.getLogger(CampaignLaunchListener.class);

    private final CampaignLaunchProcessor campaignLaunchProcessor;

    @RabbitListener(queues = MessagingTopology.Q_CAMPAIGN_LAUNCH)
    public void onEnvelope(Map<String, Object> envelope) {
        UUID campaignId;
        UUID organizationId;
        try {
            Map<?, ?> payload = payload(envelope);
            campaignId = uuid(payload.get("campaignId"));
            organizationId = uuid(payload.get("organizationId"));
        } catch (IllegalArgumentException ex) {
            log.warn("Dropping malformed campaign.launch envelope: {}", ex.getMessage());
            return;
        }
        if (campaignId == null || organizationId == null) {
            log.warn("Dropping campaign.launch envelope without campaignId/organizationId");
            return;
        }

        try {
            campaignLaunchProcessor.process(organizationId, campaignId);
        } catch (RuntimeException ex) {
            log.error("Campaign launch failed for campaign {}", campaignId, ex);
            // Rethrow so the broker can retry / dead-letter the message.
            throw ex;
        }
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
