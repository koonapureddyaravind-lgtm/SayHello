package com.omniflow.common.port;

import com.omniflow.common.domain.enums.OrganizationStatus;
import com.omniflow.common.domain.enums.OrganizationType;

import java.util.UUID;

public record OrganizationSummary(
        UUID id,
        String name,
        String slug,
        OrganizationType type,
        OrganizationStatus status,
        String role,
        UUID parentOrganizationId
) {
}
