package com.omniflow.common.port;

import com.omniflow.common.domain.enums.UsageMetric;

import java.util.UUID;

public interface BillingPort {

    void recordUsage(UUID organizationId, UsageMetric metric, int quantity, UUID campaignId, UUID messageId);
}
