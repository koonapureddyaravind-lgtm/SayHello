package com.omniflow.campaign.service;

import com.omniflow.campaign.dto.CampaignStats;
import com.omniflow.campaign.dto.CampaignView;
import com.omniflow.campaign.dto.RecipientView;
import com.omniflow.campaign.dto.UpsertCampaignRequest;
import com.omniflow.campaign.entity.Campaign;
import com.omniflow.campaign.entity.CampaignRecipient;
import com.omniflow.campaign.repository.CampaignRecipientRepository;
import com.omniflow.campaign.repository.CampaignRepository;
import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.config.MessagingTopology;
import com.omniflow.common.domain.enums.CampaignStatus;
import com.omniflow.common.domain.enums.CampaignType;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.RecipientStatus;
import com.omniflow.common.exception.BadRequestException;
import com.omniflow.common.exception.NotFoundException;
import com.omniflow.common.outbox.OutboxWriter;
import com.omniflow.common.util.PageMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CampaignService {

    private final CampaignRepository campaignRepository;
    private final CampaignRecipientRepository recipientRepository;
    private final OutboxWriter outboxWriter;
    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public PageResponse<CampaignView> list(UUID organizationId,
                                           PageQuery pageQuery,
                                           CampaignStatus status,
                                           Channel channel,
                                           String q) {
        String search = q == null || q.isBlank() ? null : q.trim();
        return PageMapper.of(campaignRepository.search(
                organizationId, status, channel, search, pageQuery.toPageRequest()), this::toView);
    }

    @Transactional(readOnly = true)
    public CampaignView get(UUID organizationId, UUID campaignId) {
        return toView(requireCampaign(organizationId, campaignId));
    }

    @Transactional
    public CampaignView create(UUID organizationId, UpsertCampaignRequest request, UUID createdBy) {
        if (request.name() == null || request.name().isBlank()) {
            throw new BadRequestException("INVALID_CAMPAIGN", "Campaign name is required");
        }
        if (request.channel() == null) {
            throw new BadRequestException("INVALID_CAMPAIGN", "Campaign channel is required");
        }

        Campaign campaign = new Campaign();
        campaign.setOrganizationId(organizationId);
        campaign.setName(request.name().trim());
        campaign.setDescription(trimToNull(request.description()));
        campaign.setChannel(request.channel());
        campaign.setType(CampaignType.BROADCAST);
        campaign.setTemplateId(request.templateId());
        campaign.setSegmentId(request.segmentId());
        campaign.setStatus(CampaignStatus.DRAFT);
        campaign.setSubject(trimToNull(request.subject()));
        campaign.setContent(request.content() == null ? Map.of() : request.content());
        campaign.setSenderName(trimToNull(request.senderName()));
        campaign.setSenderAddress(trimToNull(request.senderAddress()));
        campaign.setCreatedBy(createdBy);

        campaignRepository.save(campaign);
        return toView(campaign);
    }

    @Transactional
    public CampaignView update(UUID organizationId, UUID campaignId, UpsertCampaignRequest request) {
        Campaign campaign = requireCampaign(organizationId, campaignId);
        requireEditable(campaign);

        if (request.name() != null) {
            if (request.name().isBlank()) {
                throw new BadRequestException("INVALID_CAMPAIGN", "Campaign name cannot be blank");
            }
            campaign.setName(request.name().trim());
        }
        if (request.description() != null) {
            campaign.setDescription(trimToNull(request.description()));
        }
        if (request.channel() != null) {
            campaign.setChannel(request.channel());
        }
        if (request.templateId() != null) {
            campaign.setTemplateId(request.templateId());
        }
        if (request.segmentId() != null) {
            campaign.setSegmentId(request.segmentId());
        }
        if (request.subject() != null) {
            campaign.setSubject(trimToNull(request.subject()));
        }
        if (request.content() != null) {
            campaign.setContent(request.content());
        }
        if (request.senderName() != null) {
            campaign.setSenderName(trimToNull(request.senderName()));
        }
        if (request.senderAddress() != null) {
            campaign.setSenderAddress(trimToNull(request.senderAddress()));
        }

        campaignRepository.save(campaign);
        return toView(campaign);
    }

    @Transactional
    public void delete(UUID organizationId, UUID campaignId) {
        Campaign campaign = requireCampaign(organizationId, campaignId);
        campaign.setDeletedAt(Instant.now());
        campaignRepository.save(campaign);
    }

    @Transactional
    public CampaignView launch(UUID organizationId, UUID campaignId) {
        Campaign campaign = requireCampaign(organizationId, campaignId);
        if (campaign.getSegmentId() == null) {
            throw new BadRequestException("CAMPAIGN_AUDIENCE_REQUIRED",
                    "A campaign needs a segment before it can be launched");
        }
        if (campaign.getStatus() != CampaignStatus.DRAFT
                && campaign.getStatus() != CampaignStatus.SCHEDULED
                && campaign.getStatus() != CampaignStatus.PAUSED) {
            throw new BadRequestException("INVALID_CAMPAIGN_STATUS",
                    "Only DRAFT, SCHEDULED or PAUSED campaigns can be launched");
        }

        campaign.setStatus(CampaignStatus.QUEUED);
        campaign.setCompletedAt(null);
        campaignRepository.save(campaign);

        outboxWriter.write("campaign", campaign.getId(), MessagingTopology.CAMPAIGN_LAUNCH, organizationId,
                eventPayload(campaign.getId(), organizationId));
        return toView(campaign);
    }

    @Transactional
    public CampaignView schedule(UUID organizationId, UUID campaignId, Instant scheduledAt) {
        Campaign campaign = requireCampaign(organizationId, campaignId);
        if (scheduledAt == null || !scheduledAt.isAfter(Instant.now())) {
            throw new BadRequestException("INVALID_SCHEDULE", "Scheduled time must be in the future");
        }
        if (campaign.getStatus() != CampaignStatus.DRAFT
                && campaign.getStatus() != CampaignStatus.SCHEDULED
                && campaign.getStatus() != CampaignStatus.PAUSED) {
            throw new BadRequestException("INVALID_CAMPAIGN_STATUS",
                    "Only DRAFT, SCHEDULED or PAUSED campaigns can be scheduled");
        }

        campaign.setStatus(CampaignStatus.SCHEDULED);
        campaign.setScheduledAt(scheduledAt);
        campaignRepository.save(campaign);
        return toView(campaign);
    }

    @Transactional
    public CampaignView pause(UUID organizationId, UUID campaignId) {
        Campaign campaign = requireCampaign(organizationId, campaignId);
        if (campaign.getStatus() != CampaignStatus.QUEUED && campaign.getStatus() != CampaignStatus.RUNNING) {
            throw new BadRequestException("INVALID_CAMPAIGN_STATUS",
                    "Only QUEUED or RUNNING campaigns can be paused");
        }
        campaign.setStatus(CampaignStatus.PAUSED);
        campaignRepository.save(campaign);
        return toView(campaign);
    }

    @Transactional
    public CampaignView cancel(UUID organizationId, UUID campaignId) {
        Campaign campaign = requireCampaign(organizationId, campaignId);
        if (campaign.getStatus() == CampaignStatus.COMPLETED
                || campaign.getStatus() == CampaignStatus.CANCELLED) {
            throw new BadRequestException("INVALID_CAMPAIGN_STATUS",
                    "Completed or cancelled campaigns cannot be cancelled");
        }
        campaign.setStatus(CampaignStatus.CANCELLED);
        campaignRepository.save(campaign);
        return toView(campaign);
    }

    /**
     * Recipient counts are the source of truth for the audience; message counts are read
     * with JdbcTemplate (read-only) so delivery/webhook updates are reflected without
     * creating a JPA entity for the messaging-owned {@code messages} table.
     */
    @Transactional(readOnly = true)
    public CampaignStats stats(UUID organizationId, UUID campaignId) {
        requireCampaign(organizationId, campaignId);

        long totalRecipients = recipientRepository.countByCampaignId(campaignId);
        long skipped = recipientRepository.countByCampaignIdAndStatus(campaignId, RecipientStatus.SKIPPED);

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "select status, count(*) from messages where organization_id = ? and campaign_id = ? group by status",
                organizationId, campaignId);

        long messageQueued = count(rows, "QUEUED", "SENDING");
        long messageSent = count(rows, "SENT");
        long messageDelivered = count(rows, "DELIVERED", "READ");
        long messageFailed = count(rows, "FAILED", "BOUNCED", "REJECTED", "UNDELIVERABLE");
        long messageTotal = count(rows, "CREATED", "QUEUED", "SENDING", "SENT", "DELIVERED", "READ",
                "FAILED", "BOUNCED", "REJECTED", "UNDELIVERABLE", "CANCELLED");

        if (messageTotal == 0) {
            return new CampaignStats(
                    totalRecipients,
                    recipientRepository.countByCampaignIdAndStatus(campaignId, RecipientStatus.QUEUED),
                    recipientRepository.countByCampaignIdAndStatus(campaignId, RecipientStatus.SENT),
                    recipientRepository.countByCampaignIdAndStatus(campaignId, RecipientStatus.DELIVERED),
                    recipientRepository.countByCampaignIdAndStatus(campaignId, RecipientStatus.FAILED),
                    skipped);
        }

        return new CampaignStats(
                Math.max(totalRecipients, messageTotal),
                messageQueued,
                messageSent,
                messageDelivered,
                messageFailed,
                skipped);
    }

    @Transactional(readOnly = true)
    public PageResponse<RecipientView> recipients(UUID organizationId,
                                                  UUID campaignId,
                                                  PageQuery pageQuery,
                                                  RecipientStatus status) {
        requireCampaign(organizationId, campaignId);
        var page = status == null
                ? recipientRepository.findByCampaignIdAndOrganizationId(campaignId, organizationId,
                        pageQuery.toPageRequest())
                : recipientRepository.findByCampaignIdAndOrganizationIdAndStatus(campaignId, organizationId, status,
                        pageQuery.toPageRequest());
        return PageMapper.of(page, this::toView);
    }

    private Campaign requireCampaign(UUID organizationId, UUID campaignId) {
        return campaignRepository.findByIdAndOrganizationIdAndDeletedAtIsNull(campaignId, organizationId)
                .orElseThrow(() -> new NotFoundException("Campaign", campaignId));
    }

    private void requireEditable(Campaign campaign) {
        if (campaign.getStatus() != CampaignStatus.DRAFT && campaign.getStatus() != CampaignStatus.SCHEDULED) {
            throw new BadRequestException("INVALID_CAMPAIGN_STATUS",
                    "Only DRAFT or SCHEDULED campaigns can be edited");
        }
    }

    private CampaignView toView(Campaign campaign) {
        return new CampaignView(
                campaign.getId(),
                campaign.getName(),
                campaign.getDescription(),
                campaign.getChannel(),
                campaign.getType(),
                campaign.getTemplateId(),
                campaign.getSegmentId(),
                campaign.getStatus(),
                campaign.getSubject(),
                campaign.getContent() == null ? Map.of() : campaign.getContent(),
                campaign.getSenderName(),
                campaign.getSenderAddress(),
                campaign.getScheduledAt(),
                campaign.getStartedAt(),
                campaign.getCompletedAt(),
                campaign.getCreatedBy(),
                campaign.getCreatedAt(),
                campaign.getUpdatedAt());
    }

    private RecipientView toView(CampaignRecipient recipient) {
        return new RecipientView(
                recipient.getId(),
                recipient.getCampaignId(),
                recipient.getContactId(),
                recipient.getStatus(),
                recipient.getSkipReason(),
                recipient.getMessageId(),
                recipient.getCreatedAt(),
                recipient.getUpdatedAt());
    }

    private static long count(List<Map<String, Object>> rows, String... statuses) {
        Set<String> wanted = Set.of(statuses);
        long total = 0;
        for (Map<String, Object> row : rows) {
            Object status = row.get("status");
            if (status == null || !wanted.contains(status.toString())) {
                continue;
            }
            Object value = row.get("count");
            if (value instanceof Number number) {
                total += number.longValue();
            }
        }
        return total;
    }

    private static Map<String, Object> eventPayload(UUID campaignId, UUID organizationId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("campaignId", campaignId);
        payload.put("organizationId", organizationId);
        return payload;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
