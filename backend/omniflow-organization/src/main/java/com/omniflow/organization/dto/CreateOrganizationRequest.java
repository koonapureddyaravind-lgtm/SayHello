package com.omniflow.organization.dto;

import com.omniflow.common.domain.enums.OrganizationType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateOrganizationRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 120) String slug,
        OrganizationType type
) {
}
