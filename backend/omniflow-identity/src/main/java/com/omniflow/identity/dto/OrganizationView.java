package com.omniflow.identity.dto;

import com.omniflow.common.domain.enums.OrganizationStatus;
import com.omniflow.common.domain.enums.OrganizationType;

import java.util.UUID;

public record OrganizationView(
        UUID id,
        String name,
        String slug,
        OrganizationType type,
        String role,
        OrganizationStatus status
) {
}
