package com.omniflow.segmentation.dto;

import java.util.List;

public record PreviewRequest(List<SegmentRuleDto> rules, String matchType) {
}
