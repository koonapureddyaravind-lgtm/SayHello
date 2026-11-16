package com.omniflow.crm.domain;

import com.omniflow.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "contacts")
@Getter
@Setter
public class Contact extends BaseEntity {

    @Column(name = "organization_id", nullable = false, updatable = false)
    private UUID organizationId;

    @Column(name = "external_id")
    private String externalId;

    @Column(name = "email")
    private String email;

    @Column(name = "phone")
    private String phone;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    /**
     * Mirrors the SQL check constraint ('ACTIVE','UNSUBSCRIBED','BOUNCED','DELETED').
     */
    @Column(name = "status", nullable = false)
    private String status = "ACTIVE";

    @Column(name = "source", nullable = false)
    private String source = "MANUAL";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "attributes", nullable = false)
    private Map<String, Object> attributes = new HashMap<>();

    @Column(name = "last_engagement_at")
    private Instant lastEngagementAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
