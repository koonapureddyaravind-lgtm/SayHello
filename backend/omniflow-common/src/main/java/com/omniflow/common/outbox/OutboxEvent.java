package com.omniflow.common.outbox;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Transactional outbox row. Written in the same DB transaction as the business change,
 * then published to RabbitMQ by {@link OutboxPublisher}.
 */
@Entity
@Table(name = "outbox_events")
@Getter
@Setter
public class OutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "aggregate_type", nullable = false)
    private String aggregateType;

    @Column(name = "aggregate_id")
    private UUID aggregateId;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "organization_id")
    private UUID organizationId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", nullable = false)
    private JsonNode payload;

    @Column(name = "status", nullable = false)
    private String status = "PENDING";

    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "available_at", nullable = false)
    private Instant availableAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (availableAt == null) {
            availableAt = now;
        }
        if (status == null) {
            status = "PENDING";
        }
    }

    public void markPublished() {
        this.status = "PUBLISHED";
        this.publishedAt = Instant.now();
        this.lastError = null;
    }

    public void markFailed(String error, Instant retryAt) {
        this.attempts++;
        this.lastError = error;
        if (this.attempts >= 10) {
            this.status = "FAILED";
        } else {
            this.availableAt = retryAt;
        }
    }
}
