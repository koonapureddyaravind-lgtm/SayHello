package com.omniflow.template.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.TemplateStatus;

import java.time.Instant;
import java.util.UUID;

public record TemplateView(
        UUID id,
        String name,
        Channel channel,
        String subject,
        String body,
        String htmlBody,
        JsonNode variables,
        TemplateStatus status,
        int currentVersion,
        Instant createdAt,
        Instant updatedAt
) {
}
