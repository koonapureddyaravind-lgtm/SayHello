package com.omniflow.campaign.service;

import com.omniflow.campaign.entity.Campaign;
import com.omniflow.campaign.entity.CampaignRecipient;
import com.omniflow.campaign.repository.CampaignRecipientRepository;
import com.omniflow.campaign.repository.CampaignRepository;
import com.omniflow.common.config.MessagingTopology;
import com.omniflow.common.domain.enums.CampaignStatus;
import com.omniflow.common.domain.enums.ConsentPurpose;
import com.omniflow.common.domain.enums.RecipientStatus;
import com.omniflow.common.outbox.OutboxWriter;
import com.omniflow.common.port.AudienceResolver;
import com.omniflow.common.port.ConsentChecker;
import com.omniflow.common.port.ContactDirectory;
import com.omniflow.common.port.ContactInfo;
import com.omniflow.common.port.MessageIntakePort;
import com.omniflow.common.port.OutboundMessageCommand;
import com.omniflow.common.port.RenderedTemplate;
import com.omniflow.common.port.SuppressionChecker;
import com.omniflow.common.port.TemplatePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Materializes a campaign audience into {@code campaign_recipients} and enqueues a
 * message per eligible contact. Each batch runs in its own transaction so memory use
 * stays bounded and earlier batches survive a later failure.
 */
@Service
public class CampaignLaunchProcessor {

    private static final Logger log = LoggerFactory.getLogger(CampaignLaunchProcessor.class);

    static final int BATCH_SIZE = 500;

    private final CampaignRepository campaignRepository;
    private final CampaignRecipientRepository recipientRepository;
    private final AudienceResolver audienceResolver;
    private final ContactDirectory contactDirectory;
    private final ConsentChecker consentChecker;
    private final SuppressionChecker suppressionChecker;
    private final TemplatePort templatePort;
    private final MessageIntakePort messageIntakePort;
    private final OutboxWriter outboxWriter;
    private final TransactionTemplate transactionTemplate;

    public CampaignLaunchProcessor(CampaignRepository campaignRepository,
                                   CampaignRecipientRepository recipientRepository,
                                   AudienceResolver audienceResolver,
                                   ContactDirectory contactDirectory,
                                   ConsentChecker consentChecker,
                                   SuppressionChecker suppressionChecker,
                                   TemplatePort templatePort,
                                   MessageIntakePort messageIntakePort,
                                   OutboxWriter outboxWriter,
                                   PlatformTransactionManager transactionManager) {
        this.campaignRepository = campaignRepository;
        this.recipientRepository = recipientRepository;
        this.audienceResolver = audienceResolver;
        this.contactDirectory = contactDirectory;
        this.consentChecker = consentChecker;
        this.suppressionChecker = suppressionChecker;
        this.templatePort = templatePort;
        this.messageIntakePort = messageIntakePort;
        this.outboxWriter = outboxWriter;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public void process(UUID organizationId, UUID campaignId) {
        Campaign initial = load(organizationId, campaignId);
        if (initial == null) {
            log.warn("Ignoring launch for unknown campaign {}", campaignId);
            return;
        }
        if (initial.getStatus() != CampaignStatus.QUEUED && initial.getStatus() != CampaignStatus.PAUSED) {
            log.debug("Campaign {} is {}; launch skipped", campaignId, initial.getStatus());
            return;
        }
        if (initial.getSegmentId() == null) {
            log.warn("Campaign {} has no segment; launch skipped", campaignId);
            return;
        }

        boolean[] started = {false};
        transactionTemplate.executeWithoutResult(status -> {
            Campaign campaign = load(organizationId, campaignId);
            if (campaign != null
                    && (campaign.getStatus() == CampaignStatus.QUEUED
                    || campaign.getStatus() == CampaignStatus.PAUSED)) {
                campaign.setStatus(CampaignStatus.RUNNING);
                if (campaign.getStartedAt() == null) {
                    campaign.setStartedAt(Instant.now());
                }
                campaignRepository.save(campaign);
                started[0] = true;
            }
        });
        if (!started[0]) {
            return;
        }

        long[] queued = {0};
        long[] skipped = {0};
        int offset = 0;

        while (true) {
            Campaign snapshot = load(organizationId, campaignId);
            if (snapshot == null || snapshot.getStatus() != CampaignStatus.RUNNING) {
                break;
            }
            UUID segmentId = snapshot.getSegmentId();
            if (segmentId == null) {
                break;
            }

            List<UUID> contactIds = audienceResolver.resolveContactIds(
                    organizationId, segmentId, BATCH_SIZE, offset);
            if (contactIds == null || contactIds.isEmpty()) {
                break;
            }

            Map<UUID, ContactInfo> contacts = contactDirectory.findByIds(organizationId, contactIds).stream()
                    .collect(Collectors.toMap(ContactInfo::id, Function.identity(), (first, second) -> first));
            Campaign batchCampaign = snapshot;

            transactionTemplate.executeWithoutResult(status -> {
                for (UUID contactId : contactIds) {
                    if (recipientRepository.existsByCampaignIdAndContactId(campaignId, contactId)) {
                        continue;
                    }
                    ContactInfo contact = contacts.get(contactId);

                    String skipReason = skipReason(organizationId, batchCampaign, contact);
                    if (skipReason != null) {
                        saveSkipped(organizationId, campaignId, contactId, skipReason);
                        skipped[0]++;
                        continue;
                    }

                    String address = contact.addressFor(batchCampaign.getChannel());
                    RenderedTemplate rendered = render(organizationId, batchCampaign, contact);
                    if (batchCampaign.getTemplateId() != null && rendered == null) {
                        saveSkipped(organizationId, campaignId, contactId, "TEMPLATE_UNAVAILABLE");
                        skipped[0]++;
                        continue;
                    }

                    String subject = rendered == null ? batchCampaign.getSubject() : rendered.subject();
                    String body = rendered == null ? contentValue(batchCampaign, "body") : rendered.body();
                    String htmlBody = rendered == null ? contentValue(batchCampaign, "htmlBody") : rendered.htmlBody();

                    Map<String, Object> metadata = new HashMap<>();
                    metadata.put("campaignId", campaignId);
                    metadata.put("contactId", contactId);
                    if (batchCampaign.getSenderName() != null) {
                        metadata.put("senderName", batchCampaign.getSenderName());
                    }

                    OutboundMessageCommand command = OutboundMessageCommand.builder()
                            .organizationId(organizationId)
                            .campaignId(campaignId)
                            .contactId(contactId)
                            .channel(batchCampaign.getChannel())
                            .templateId(batchCampaign.getTemplateId())
                            .subject(subject)
                            .body(body)
                            .htmlBody(htmlBody)
                            .toAddress(address)
                            .fromAddress(batchCampaign.getSenderAddress())
                            .idempotencyKey("campaign:" + campaignId + ":contact:" + contactId)
                            .metadata(metadata)
                            .build();

                    UUID messageId = messageIntakePort.enqueue(command);
                    saveQueued(organizationId, campaignId, contactId, messageId);
                    queued[0]++;
                }
            });

            offset += contactIds.size();
            if (contactIds.size() < BATCH_SIZE) {
                break;
            }
        }

        long total = queued[0] + skipped[0];
        transactionTemplate.executeWithoutResult(status -> {
            Campaign campaign = load(organizationId, campaignId);
            if (campaign != null && campaign.getStatus() == CampaignStatus.RUNNING) {
                campaign.setStatus(CampaignStatus.COMPLETED);
                campaign.setCompletedAt(Instant.now());
                campaignRepository.save(campaign);

                Map<String, Object> payload = new HashMap<>();
                payload.put("campaignId", campaignId);
                payload.put("organizationId", organizationId);
                payload.put("total", total);
                payload.put("queued", queued[0]);
                payload.put("skipped", skipped[0]);
                outboxWriter.write("campaign", campaignId, MessagingTopology.CAMPAIGN_DISPATCHED,
                        organizationId, payload);
            }
        });
    }

    private String skipReason(UUID organizationId, Campaign campaign, ContactInfo contact) {
        if (contact == null) {
            return "NO_CONTACT";
        }
        if (!"ACTIVE".equalsIgnoreCase(contact.status())) {
            return "INACTIVE";
        }
        String address = contact.addressFor(campaign.getChannel());
        if (address == null || address.isBlank()) {
            return "NO_ADDRESS";
        }
        if (suppressionChecker.isSuppressed(organizationId, contact.email(), contact.phone(), campaign.getChannel())) {
            return "SUPPRESSED";
        }
        if (!consentChecker.canSend(organizationId, contact.id(), campaign.getChannel(), ConsentPurpose.MARKETING)) {
            return "NO_CONSENT";
        }
        return null;
    }

    private RenderedTemplate render(UUID organizationId, Campaign campaign, ContactInfo contact) {
        if (campaign.getTemplateId() == null) {
            return null;
        }
        Map<String, Object> variables = new HashMap<>();
        putIfNotNull(variables, "firstName", contact.firstName());
        putIfNotNull(variables, "lastName", contact.lastName());
        putIfNotNull(variables, "email", contact.email());
        putIfNotNull(variables, "phone", contact.phone());
        if (contact.attributes() != null) {
            contact.attributes().forEach(variables::putIfAbsent);
        }
        return templatePort.render(organizationId, campaign.getTemplateId(), variables).orElse(null);
    }

    private void saveQueued(UUID organizationId, UUID campaignId, UUID contactId, UUID messageId) {
        CampaignRecipient recipient = new CampaignRecipient();
        recipient.setOrganizationId(organizationId);
        recipient.setCampaignId(campaignId);
        recipient.setContactId(contactId);
        recipient.setStatus(RecipientStatus.QUEUED);
        recipient.setMessageId(messageId);
        recipientRepository.save(recipient);
    }

    private void saveSkipped(UUID organizationId, UUID campaignId, UUID contactId, String reason) {
        CampaignRecipient recipient = new CampaignRecipient();
        recipient.setOrganizationId(organizationId);
        recipient.setCampaignId(campaignId);
        recipient.setContactId(contactId);
        recipient.setStatus(RecipientStatus.SKIPPED);
        recipient.setSkipReason(reason);
        recipientRepository.save(recipient);
    }

    private Campaign load(UUID organizationId, UUID campaignId) {
        return campaignRepository.findByIdAndOrganizationIdAndDeletedAtIsNull(campaignId, organizationId)
                .orElse(null);
    }

    private static String contentValue(Campaign campaign, String key) {
        if (campaign.getContent() == null) {
            return null;
        }
        Object value = campaign.getContent().get(key);
        return value == null ? null : value.toString();
    }

    private static void putIfNotNull(Map<String, Object> map, String key, Object value) {
        if (value != null) {
            map.put(key, value);
        }
    }
}
