package com.omniflow.template.dto;

import com.omniflow.common.domain.enums.Channel;
import jakarta.validation.constraints.Size;

public record UpsertTemplateRequest(
        @Size(max = 160) String name,
        Channel channel,
        @Size(max = 500) String subject,
        String body,
        String htmlBody
) {
}
