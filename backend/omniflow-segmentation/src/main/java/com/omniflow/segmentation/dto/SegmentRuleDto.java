package com.omniflow.segmentation.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record SegmentRuleDto(
        String field,
        String operator,
        JsonNode value,
        String logicGroup
) {
}
