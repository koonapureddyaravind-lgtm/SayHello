package com.omniflow.organization.dto;

import com.omniflow.common.domain.enums.OrganizationStatus;
import com.omniflow.common.domain.enums.OrganizationType;

import java.util.UUID;

public record WorkspaceView(
        UUID id,
        String name,
        String slug,
        OrganizationType type,
        OrganizationStatus status,
        String role
) {
}
