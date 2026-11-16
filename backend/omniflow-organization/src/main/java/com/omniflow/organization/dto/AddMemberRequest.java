package com.omniflow.organization.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record AddMemberRequest(
        @NotBlank @Email String email,
        @NotBlank String role
) {
}
