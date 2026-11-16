package com.omniflow.automation.domain;

import com.omniflow.common.domain.enums.StepStatus;
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
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "workflow_execution_steps")
@Getter
@Setter
public class WorkflowExecutionStep {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "execution_id", nullable = false)
    private UUID executionId;

    @Column(name = "node_key", nullable = false)
    private String nodeKey;

    @Column(name = "node_type", nullable = false)
    private String nodeType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private StepStatus status = StepStatus.RUNNING;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input")
    private Map<String, Object> input = new LinkedHashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "output")
    private Map<String, Object> output = new LinkedHashMap<>();

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (startedAt == null) {
            startedAt = now;
        }
    }
}
