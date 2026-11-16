package com.omniflow.billing.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.omniflow.billing.domain.Plan;

import java.util.UUID;

public record PlanView(
        UUID id,
        String code,
        String name,
        String description,
        int priceMonthlyCents,
        String currency,
        int includedEmails,
        int includedWhatsapp,
        int includedSms,
        long overageEmailMicros,
        long overageWhatsappMicros,
        long overageSmsMicros,
        JsonNode features,
        boolean isPublic,
        int sortOrder
) {
    public static PlanView of(Plan plan) {
        return new PlanView(
                plan.getId(),
                plan.getCode(),
                plan.getName(),
                plan.getDescription(),
                plan.getPriceMonthlyCents(),
                plan.getCurrency(),
                plan.getIncludedEmails(),
                plan.getIncludedWhatsapp(),
                plan.getIncludedSms(),
                plan.getOverageEmailMicros(),
                plan.getOverageWhatsappMicros(),
                plan.getOverageSmsMicros(),
                plan.getFeatures(),
                plan.isPublic(),
                plan.getSortOrder()
        );
    }
}
