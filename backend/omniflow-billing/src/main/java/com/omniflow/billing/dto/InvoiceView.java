package com.omniflow.billing.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.omniflow.billing.domain.Invoice;
import com.omniflow.common.domain.enums.InvoiceStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record InvoiceView(
        UUID id,
        UUID organizationId,
        String number,
        InvoiceStatus status,
        long subtotalCents,
        long taxCents,
        long totalCents,
        String currency,
        LocalDate periodStart,
        LocalDate periodEnd,
        Instant dueAt,
        Instant paidAt,
        JsonNode lineItems,
        Instant createdAt
) {
    public static InvoiceView of(Invoice invoice) {
        return new InvoiceView(
                invoice.getId(),
                invoice.getOrganizationId(),
                invoice.getNumber(),
                invoice.getStatus(),
                invoice.getSubtotalCents(),
                invoice.getTaxCents(),
                invoice.getTotalCents(),
                invoice.getCurrency(),
                invoice.getPeriodStart(),
                invoice.getPeriodEnd(),
                invoice.getDueAt(),
                invoice.getPaidAt(),
                invoice.getLineItems(),
                invoice.getCreatedAt()
        );
    }
}
