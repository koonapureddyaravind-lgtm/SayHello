package com.omniflow.billing.dto;

import com.omniflow.common.domain.enums.UsageMetric;

public record UsageLine(
        UsageMetric metric,
        long used,
        long included,
        long overage,
        long costMicros
) {
}
