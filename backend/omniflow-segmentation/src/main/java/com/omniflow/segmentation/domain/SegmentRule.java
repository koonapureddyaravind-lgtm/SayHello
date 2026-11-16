package com.omniflow.segmentation.domain;

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

@Entity
@Table(name = "segment_rules")
@Getter
@Setter
public class SegmentRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "segment_id", nullable = false)
    private UUID segmentId;

    @Column(name = "field", nullable = false)
    private String field;

    @Column(name = "operator", nullable = false)
    private String operator;

    /**
     * Java field is named ruleValue because {@code value} is a reserved HQL token;
     * the database column is still {@code value}.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "value")
    private JsonNode ruleValue;

    @Column(name = "logic_group", nullable = false)
    private String logicGroup = "AND";

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (logicGroup == null || logicGroup.isBlank()) {
            logicGroup = "AND";
        }
    }
}
