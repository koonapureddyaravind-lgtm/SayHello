package com.omniflow.automation.domain;

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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "workflow_nodes")
@Getter
@Setter
public class WorkflowNode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "workflow_version_id", nullable = false)
    private UUID workflowVersionId;

    @Column(name = "node_key", nullable = false)
    private String nodeKey;

    @Column(name = "type", nullable = false)
    private String type;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "config", nullable = false)
    private Map<String, Object> config = new LinkedHashMap<>();

    @Column(name = "position_x", nullable = false)
    private BigDecimal positionX = BigDecimal.ZERO;

    @Column(name = "position_y", nullable = false)
    private BigDecimal positionY = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (positionX == null) {
            positionX = BigDecimal.ZERO;
        }
        if (positionY == null) {
            positionY = BigDecimal.ZERO;
        }
    }
}
