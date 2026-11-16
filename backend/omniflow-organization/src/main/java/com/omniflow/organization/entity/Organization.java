package com.omniflow.organization.entity;

import com.omniflow.common.domain.BaseEntity;
import com.omniflow.common.domain.enums.OrganizationStatus;
import com.omniflow.common.domain.enums.OrganizationType;
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
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "organizations")
@Getter
@Setter
public class Organization extends BaseEntity {

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "slug", nullable = false, unique = true)
    private String slug;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private OrganizationType type = OrganizationType.BUSINESS;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private OrganizationStatus status = OrganizationStatus.ACTIVE;

    @Column(name = "parent_organization_id")
    private UUID parentOrganizationId;

    @Column(name = "plan_id")
    private UUID planId;

    @Column(name = "timezone", nullable = false)
    private String timezone = "UTC";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "settings", nullable = false)
    private Map<String, Object> settings = new HashMap<>();

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
