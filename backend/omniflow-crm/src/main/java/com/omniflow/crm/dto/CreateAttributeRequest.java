package com.omniflow.crm.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateAttributeRequest(
        @NotBlank @Size(max = 64) String key,
        @Size(max = 128) String label,
        String dataType
) {
}
