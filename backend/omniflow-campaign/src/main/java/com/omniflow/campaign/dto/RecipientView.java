package com.omniflow.campaign.dto;

import com.omniflow.common.domain.enums.RecipientStatus;

import java.time.Instant;
import java.util.UUID;

public record RecipientView(
        UUID id,
        UUID campaignId,
        UUID contactId,
        RecipientStatus status,
        String skipReason,
        UUID messageId,
        Instant createdAt,
        Instant updatedAt
) {
}
