package com.omniflow.campaign.dto;

import com.omniflow.common.domain.enums.Channel;
import jakarta.validation.constraints.Size;

import java.util.Map;
import java.util.UUID;

/**
 * Create/update payload. Fields are optional on PATCH; the service enforces the
 * required name/channel pair on create.
 */
public record UpsertCampaignRequest(
        @Size(max = 200) String name,
        @Size(max = 2000) String description,
        Channel channel,
        UUID templateId,
        UUID segmentId,
        @Size(max = 500) String subject,
        Map<String, Object> content,
        @Size(max = 200) String senderName,
        @Size(max = 320) String senderAddress
) {
}
