package com.omniflow.organization.dto;

import jakarta.validation.constraints.Size;

import java.util.Map;

public record UpdateOrganizationRequest(
        @Size(max = 255) String name,
        @Size(max = 64) String timezone,
        Map<String, Object> settings
) {
}
