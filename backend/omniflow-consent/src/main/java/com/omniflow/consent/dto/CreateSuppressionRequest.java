package com.omniflow.consent.dto;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.SuppressionReason;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record CreateSuppressionRequest(
        @Size(max = 320) String email,
        @Size(max = 40) String phone,
        Channel channel,
        @NotNull SuppressionReason reason,
        @Size(max = 500) String note,
        Instant expiresAt
) {
}
