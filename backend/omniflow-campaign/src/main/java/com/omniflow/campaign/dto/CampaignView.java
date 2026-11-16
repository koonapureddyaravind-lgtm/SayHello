package com.omniflow.campaign.dto;

import com.omniflow.common.domain.enums.CampaignStatus;
import com.omniflow.common.domain.enums.CampaignType;
import com.omniflow.common.domain.enums.Channel;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record CampaignView(
        UUID id,
        String name,
        String description,
        Channel channel,
        CampaignType type,
        UUID templateId,
        UUID segmentId,
        CampaignStatus status,
        String subject,
        Map<String, Object> content,
        String senderName,
        String senderAddress,
        Instant scheduledAt,
        Instant startedAt,
        Instant completedAt,
        UUID createdBy,
        Instant createdAt,
        Instant updatedAt
) {
}
