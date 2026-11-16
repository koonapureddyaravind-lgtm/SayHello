package com.omniflow.messaging.entity;

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
import java.util.Map;
import java.util.UUID;

/**
 * Normalized provider webhook event. Unique on (provider, provider_event_id).
 */
@Entity
@Table(name = "message_events")
@Getter
@Setter
public class MessageEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "message_id")
    private UUID messageId;

    @Column(name = "provider", nullable = false)
    private String provider;

    @Column(name = "provider_event_id")
    private String providerEventId;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "event_time", nullable = false)
    private Instant eventTime;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", nullable = false)
    private Map<String, Object> payload = Map.of();

    @Column(name = "processed_at")
    private Instant processedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (eventTime == null) {
            eventTime = now;
        }
        if (payload == null) {
            payload = Map.of();
        }
    }
}
