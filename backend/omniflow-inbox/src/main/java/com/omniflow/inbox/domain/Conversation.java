package com.omniflow.inbox.domain;

import com.omniflow.common.domain.BaseEntity;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.ConversationStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "conversations")
@Getter
@Setter
public class Conversation extends BaseEntity {

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "contact_id", nullable = false)
    private UUID contactId;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false)
    private Channel channel;

    @Column(name = "provider_account_id")
    private UUID providerAccountId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ConversationStatus status = ConversationStatus.OPEN;

    @Column(name = "subject")
    private String subject;

    @Column(name = "assignee_user_id")
    private UUID assigneeUserId;

    @Column(name = "last_message_at", nullable = false)
    private Instant lastMessageAt;

    @Column(name = "unread_count", nullable = false)
    private int unreadCount;
}
