package com.omniflow.identity.dto;

import com.omniflow.common.domain.enums.OrganizationType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(min = 8, max = 100) String password,
        @Size(max = 255) String fullName,
        @NotBlank @Size(max = 255) String organizationName,
        OrganizationType organizationType
) {
}
