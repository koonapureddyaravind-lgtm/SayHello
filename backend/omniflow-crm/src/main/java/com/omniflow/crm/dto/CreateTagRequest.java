package com.omniflow.crm.dto;

import jakarta.validation.constraints.Size;

public record CreateTagRequest(
        @Size(max = 64) String name,
        String color
) {
}
