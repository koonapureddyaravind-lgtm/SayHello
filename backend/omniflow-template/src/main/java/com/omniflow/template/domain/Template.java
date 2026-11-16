package com.omniflow.template.domain;

import com.fasterxml.jackson.databind.JsonNode;
import com.omniflow.common.domain.BaseEntity;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.TemplateStatus;
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
@Table(name = "templates")
@Getter
@Setter
public class Template extends BaseEntity {

    @Column(name = "organization_id", nullable = false, updatable = false)
    private UUID organizationId;

    @Column(name = "name", nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false)
    private Channel channel;

    @Column(name = "subject")
    private String subject;

    @Column(name = "body", nullable = false)
    private String body = "";

    @Column(name = "html_body")
    private String htmlBody;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "variables", nullable = false)
    private JsonNode variables;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private TemplateStatus status = TemplateStatus.DRAFT;

    @Column(name = "current_version", nullable = false)
    private int currentVersion = 1;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
