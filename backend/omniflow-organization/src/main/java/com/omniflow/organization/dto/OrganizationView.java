package com.omniflow.organization.dto;

import com.omniflow.common.domain.enums.OrganizationStatus;
import com.omniflow.common.domain.enums.OrganizationType;

import java.time.Instant;
import java.util.UUID;

public record OrganizationView(
        UUID id,
        String name,
        String slug,
        OrganizationType type,
        OrganizationStatus status,
        UUID parentOrganizationId,
        String timezone,
        Instant createdAt
) {
}
