package com.omniflow.campaign.entity;

import com.omniflow.common.domain.BaseEntity;
import com.omniflow.common.domain.enums.CampaignStatus;
import com.omniflow.common.domain.enums.CampaignType;
import com.omniflow.common.domain.enums.Channel;
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
import java.util.Map;
import java.util.UUID;

/**
 * A broadcast campaign. The audience is always {@link #segmentId}; the legacy
 * campaign_audiences table is intentionally not mapped because a campaign has a
 * single audience source.
 */
@Entity
@Table(name = "campaigns")
@Getter
@Setter
public class Campaign extends BaseEntity {

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false)
    private Channel channel;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private CampaignType type = CampaignType.BROADCAST;

    @Column(name = "template_id")
    private UUID templateId;

    @Column(name = "segment_id")
    private UUID segmentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private CampaignStatus status = CampaignStatus.DRAFT;

    @Column(name = "subject")
    private String subject;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "content", nullable = false)
    private Map<String, Object> content = Map.of();

    @Column(name = "sender_name")
    private String senderName;

    @Column(name = "sender_address")
    private String senderAddress;

    @Column(name = "scheduled_at")
    private Instant scheduledAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
