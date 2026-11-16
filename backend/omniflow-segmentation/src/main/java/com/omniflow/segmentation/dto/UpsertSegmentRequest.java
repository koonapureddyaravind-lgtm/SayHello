package com.omniflow.segmentation.dto;

import com.omniflow.common.domain.enums.SegmentType;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpsertSegmentRequest(
        @Size(max = 160) String name,
        @Size(max = 1000) String description,
        SegmentType type,
        String matchType,
        List<SegmentRuleDto> rules
) {
}
