package com.omniflow.automation.domain;

import com.omniflow.common.domain.BaseEntity;
import com.omniflow.common.domain.enums.ExecutionStatus;
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
@Table(name = "workflow_executions")
@Getter
@Setter
public class WorkflowExecution extends BaseEntity {

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "workflow_id", nullable = false)
    private UUID workflowId;

    @Column(name = "workflow_version_id", nullable = false)
    private UUID workflowVersionId;

    @Column(name = "contact_id", nullable = false)
    private UUID contactId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ExecutionStatus status = ExecutionStatus.RUNNING;

    @Column(name = "current_node_key")
    private String currentNodeKey;

    @Column(name = "next_run_at")
    private Instant nextRunAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "context", nullable = false)
    private Map<String, Object> context = new LinkedHashMap<>();

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;
}
