package com.omniflow.messaging.entity;

import com.omniflow.common.domain.BaseEntity;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.Direction;
import com.omniflow.common.domain.enums.MessageStatus;
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

@Entity
@Table(name = "messages")
@Getter
@Setter
public class Message extends BaseEntity {

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "campaign_id")
    private UUID campaignId;

    @Column(name = "contact_id")
    private UUID contactId;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false)
    private Channel channel;

    @Column(name = "provider_account_id")
    private UUID providerAccountId;

    @Enumerated(EnumType.STRING)
    @Column(name = "direction", nullable = false)
    private Direction direction = Direction.OUTBOUND;

    @Column(name = "provider")
    private String provider;

    @Column(name = "provider_message_id")
    private String providerMessageId;

    @Column(name = "idempotency_key", nullable = false, unique = true)
    private String idempotencyKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private MessageStatus status = MessageStatus.QUEUED;

    @Column(name = "subject")
    private String subject;

    @Column(name = "body")
    private String body;

    @Column(name = "html_body")
    private String htmlBody;

    @Column(name = "to_address")
    private String toAddress;

    @Column(name = "from_address")
    private String fromAddress;

    @Column(name = "error_code")
    private String errorCode;

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "scheduled_at")
    private Instant scheduledAt;

    @Column(name = "queued_at")
    private Instant queuedAt;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "delivered_at")
    private Instant deliveredAt;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "failed_at")
    private Instant failedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", nullable = false)
    private Map<String, Object> metadata = Map.of();
}
