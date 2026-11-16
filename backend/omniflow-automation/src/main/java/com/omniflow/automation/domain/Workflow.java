package com.omniflow.automation.domain;

import com.omniflow.common.domain.BaseEntity;
import com.omniflow.common.domain.enums.WorkflowStatus;
import com.omniflow.common.domain.enums.WorkflowTriggerType;
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
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "workflows")
@Getter
@Setter
public class Workflow extends BaseEntity {

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private WorkflowStatus status = WorkflowStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(name = "trigger_type", nullable = false)
    private WorkflowTriggerType triggerType = WorkflowTriggerType.CONTACT_CREATED;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "trigger_config", nullable = false)
    private Map<String, Object> triggerConfig = new LinkedHashMap<>();

    @Column(name = "current_version", nullable = false)
    private int currentVersion;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
