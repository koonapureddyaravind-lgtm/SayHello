package com.omniflow.segmentation.domain;

import com.fasterxml.jackson.databind.JsonNode;
import com.omniflow.common.domain.BaseEntity;
import com.omniflow.common.domain.enums.SegmentType;
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
import java.util.UUID;

@Entity
@Table(name = "segments")
@Getter
@Setter
public class Segment extends BaseEntity {

    @Column(name = "organization_id", nullable = false, updatable = false)
    private UUID organizationId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private SegmentType type = SegmentType.DYNAMIC;

    @Column(name = "match_type", nullable = false)
    private String matchType = "ALL";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "rules", nullable = false)
    private JsonNode rules;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
