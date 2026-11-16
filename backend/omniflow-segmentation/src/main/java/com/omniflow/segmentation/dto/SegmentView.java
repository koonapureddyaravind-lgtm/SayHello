package com.omniflow.segmentation.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.omniflow.common.domain.enums.SegmentType;

import java.time.Instant;
import java.util.UUID;

public record SegmentView(
        UUID id,
        String name,
        String description,
        SegmentType type,
        String matchType,
        JsonNode rules,
        long contactCount,
        Instant createdAt,
        Instant updatedAt
) {
}
