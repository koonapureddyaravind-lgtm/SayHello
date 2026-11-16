package com.omniflow.billing.dto;

import com.omniflow.billing.domain.Plan;
import com.omniflow.billing.domain.Subscription;
import com.omniflow.common.domain.enums.SubscriptionStatus;

import java.time.Instant;
import java.util.UUID;

public record SubscriptionView(
        UUID id,
        UUID organizationId,
        UUID planId,
        String planCode,
        String planName,
        SubscriptionStatus status,
        Instant currentPeriodStart,
        Instant currentPeriodEnd,
        Instant trialEndsAt,
        Instant canceledAt,
        String providerSubscriptionId
) {
    public static SubscriptionView of(Subscription subscription, Plan plan) {
        return new SubscriptionView(
                subscription.getId(),
                subscription.getOrganizationId(),
                subscription.getPlanId(),
                plan == null ? null : plan.getCode(),
                plan == null ? null : plan.getName(),
                subscription.getStatus(),
                subscription.getCurrentPeriodStart(),
                subscription.getCurrentPeriodEnd(),
                subscription.getTrialEndsAt(),
                subscription.getCanceledAt(),
                subscription.getProviderSubscriptionId()
        );
    }
}
