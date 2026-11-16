package com.omniflow.messaging.entity;

import com.omniflow.common.domain.enums.WebhookStatus;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Raw inbound webhook row. Unique on (provider, event_id) and has no updated_at.
 */
@Entity
@Table(name = "webhook_events")
@Getter
@Setter
public class WebhookEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "provider", nullable = false)
    private String provider;

    @Column(name = "event_id", nullable = false)
    private String eventId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", nullable = false)
    private Map<String, Object> payload = Map.of();

    @Column(name = "signature_valid", nullable = false)
    private boolean signatureValid;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private WebhookStatus status = WebhookStatus.RECEIVED;

    @Column(name = "error")
    private String error;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    @Column(name = "processed_at")
    private Instant processedAt;

    @PrePersist
    void onCreate() {
        if (receivedAt == null) {
            receivedAt = Instant.now();
        }
        if (status == null) {
            status = WebhookStatus.RECEIVED;
        }
        if (payload == null) {
            payload = Map.of();
        }
    }
}
