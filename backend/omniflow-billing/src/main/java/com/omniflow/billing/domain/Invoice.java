package com.omniflow.billing.domain;

import com.fasterxml.jackson.databind.JsonNode;
import com.omniflow.common.domain.BaseEntity;
import com.omniflow.common.domain.enums.InvoiceStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "invoices")
@Getter
@Setter
public class Invoice extends BaseEntity {

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "number", nullable = false)
    private String number;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private InvoiceStatus status = InvoiceStatus.DRAFT;

    @Column(name = "subtotal_cents", nullable = false)
    private long subtotalCents;

    @Column(name = "tax_cents", nullable = false)
    private long taxCents;

    @Column(name = "total_cents", nullable = false)
    private long totalCents;

    @Column(name = "currency", nullable = false)
    private String currency = "USD";

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Column(name = "due_at")
    private Instant dueAt;

    @Column(name = "paid_at")
    private Instant paidAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "line_items", nullable = false)
    private JsonNode lineItems;
}
