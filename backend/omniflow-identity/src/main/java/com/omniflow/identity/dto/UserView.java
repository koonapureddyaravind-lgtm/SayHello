package com.omniflow.identity.dto;

import com.omniflow.common.domain.enums.UserStatus;

import java.time.Instant;
import java.util.UUID;

public record UserView(
        UUID id,
        String email,
        String fullName,
        UserStatus status,
        Instant createdAt
) {
}
