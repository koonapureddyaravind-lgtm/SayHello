package com.omniflow.consent.dto;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.SuppressionReason;

import java.time.Instant;
import java.util.UUID;

public record SuppressionView(
        UUID id,
        Channel channel,
        String email,
        String phone,
        SuppressionReason reason,
        String note,
        Instant expiresAt,
        Instant createdAt
) {
}
