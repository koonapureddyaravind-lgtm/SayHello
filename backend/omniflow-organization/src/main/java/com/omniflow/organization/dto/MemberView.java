package com.omniflow.organization.dto;

import com.omniflow.common.domain.enums.MembershipStatus;

import java.time.Instant;
import java.util.UUID;

public record MemberView(
        UUID membershipId,
        UUID userId,
        String email,
        String fullName,
        String role,
        MembershipStatus status,
        Instant joinedAt
) {
}
