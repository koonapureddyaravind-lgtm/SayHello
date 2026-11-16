package com.omniflow.campaign.scheduler;

import com.omniflow.campaign.entity.Campaign;
import com.omniflow.campaign.repository.CampaignRepository;
import com.omniflow.common.config.MessagingTopology;
import com.omniflow.common.domain.enums.CampaignStatus;
import com.omniflow.common.outbox.OutboxWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Worker-only poller that turns due SCHEDULED campaigns into QUEUED and emits the
 * campaign.launch event through the transactional outbox.
 */
@Component
@Profile("worker")
public class CampaignScheduler {

    private static final Logger log = LoggerFactory.getLogger(CampaignScheduler.class);
    private static final int DUE_LIMIT = 20;

    private final CampaignRepository campaignRepository;
    private final OutboxWriter outboxWriter;
    private final TransactionTemplate transactionTemplate;

    public CampaignScheduler(CampaignRepository campaignRepository,
                             OutboxWriter outboxWriter,
                             PlatformTransactionManager transactionManager) {
        this.campaignRepository = campaignRepository;
        this.outboxWriter = outboxWriter;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Scheduled(fixedDelay = 30000)
    public void launchDueCampaigns() {
        List<Campaign> due = campaignRepository.findDueScheduled(Instant.now(), PageRequest.of(0, DUE_LIMIT));
        for (Campaign candidate : due) {
            try {
                transactionTemplate.executeWithoutResult(status -> {
                    Campaign campaign = campaignRepository.findById(candidate.getId()).orElse(null);
                    if (campaign == null || campaign.getStatus() != CampaignStatus.SCHEDULED) {
                        return;
                    }
                    campaign.setStatus(CampaignStatus.QUEUED);
                    campaignRepository.save(campaign);

                    Map<String, Object> payload = new HashMap<>();
                    payload.put("campaignId", campaign.getId());
                    payload.put("organizationId", campaign.getOrganizationId());
                    outboxWriter.write("campaign", campaign.getId(), MessagingTopology.CAMPAIGN_LAUNCH,
                            campaign.getOrganizationId(), payload);
                });
            } catch (RuntimeException ex) {
                log.error("Failed to queue scheduled campaign {}", candidate.getId(), ex);
            }
        }
    }
}
