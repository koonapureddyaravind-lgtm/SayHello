package com.omniflow.campaign.dto;

public record CampaignStats(
        long totalRecipients,
        long queued,
        long sent,
        long delivered,
        long failed,
        long skipped
) {
}
