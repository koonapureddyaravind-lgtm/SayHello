package com.omniflow.billing.domain;

import com.omniflow.common.domain.enums.UsageMetric;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "usage_records")
@Getter
@Setter
public class UsageRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "metric", nullable = false)
    private UsageMetric metric;

    @Column(name = "quantity", nullable = false)
    private int quantity = 1;

    @Column(name = "unit_cost_micros", nullable = false)
    private long unitCostMicros;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Column(name = "campaign_id")
    private UUID campaignId;

    @Column(name = "message_id")
    private UUID messageId;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (recordedAt == null) {
            recordedAt = now;
        }
        if (createdAt == null) {
            createdAt = now;
        }
    }
}
