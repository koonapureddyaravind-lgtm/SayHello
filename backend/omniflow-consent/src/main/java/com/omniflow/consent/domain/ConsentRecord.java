package com.omniflow.consent.domain;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.ConsentPurpose;
import com.omniflow.common.domain.enums.ConsentStatus;
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
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "consent_records")
@Getter
@Setter
public class ConsentRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "organization_id", nullable = false, updatable = false)
    private UUID organizationId;

    @Column(name = "contact_id", nullable = false, updatable = false)
    private UUID contactId;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false)
    private Channel channel;

    @Enumerated(EnumType.STRING)
    @Column(name = "purpose", nullable = false)
    private ConsentPurpose purpose = ConsentPurpose.MARKETING;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ConsentStatus status;

    @Column(name = "source", nullable = false)
    private String source;

    @Column(name = "ip_address")
    private String ipAddress;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "evidence", nullable = false)
    private Map<String, Object> evidence = new HashMap<>();

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (occurredAt == null) {
            occurredAt = now;
        }
        if (createdAt == null) {
            createdAt = now;
        }
        if (purpose == null) {
            purpose = ConsentPurpose.MARKETING;
        }
        if (evidence == null) {
            evidence = new HashMap<>();
        }
    }
}
