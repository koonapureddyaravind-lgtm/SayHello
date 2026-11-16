package com.omniflow.campaign.entity;

import com.omniflow.common.domain.BaseEntity;
import com.omniflow.common.domain.enums.RecipientStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

/**
 * Materialized recipient of a campaign. Unique per (campaign_id, contact_id),
 * which makes the launch processor safe to run more than once.
 */
@Entity
@Table(name = "campaign_recipients")
@Getter
@Setter
public class CampaignRecipient extends BaseEntity {

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "campaign_id", nullable = false)
    private UUID campaignId;

    @Column(name = "contact_id", nullable = false)
    private UUID contactId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private RecipientStatus status = RecipientStatus.PENDING;

    @Column(name = "skip_reason")
    private String skipReason;

    @Column(name = "message_id")
    private UUID messageId;
}
