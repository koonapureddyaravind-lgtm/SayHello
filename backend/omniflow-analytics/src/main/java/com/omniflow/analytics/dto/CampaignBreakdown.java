package com.omniflow.analytics.dto;

import com.omniflow.common.domain.enums.CampaignStatus;
import com.omniflow.common.domain.enums.Channel;

import java.util.UUID;

public record CampaignBreakdown(
        UUID campaignId,
        String name,
        Channel channel,
        CampaignStatus status,
        long totalRecipients,
        long sent,
        long delivered,
        long failed
) {
}
