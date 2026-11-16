package com.omniflow.billing.dto;

import java.util.List;

public record UsageSummary(
        String period,
        String planCode,
        List<UsageLine> metrics
) {
}
