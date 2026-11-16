package com.omniflow.template.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

public record VersionView(
        UUID id,
        int version,
        String subject,
        String body,
        String htmlBody,
        JsonNode variables,
        UUID createdBy,
        Instant createdAt
) {
}
