package com.omniflow.inbox.domain;

import com.fasterxml.jackson.databind.JsonNode;
import com.omniflow.common.domain.enums.Direction;
import com.omniflow.common.domain.enums.SenderType;
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
import java.util.UUID;

@Entity
@Table(name = "conversation_messages")
@Getter
@Setter
public class ConversationMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "conversation_id", nullable = false)
    private UUID conversationId;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "direction", nullable = false)
    private Direction direction;

    @Enumerated(EnumType.STRING)
    @Column(name = "sender_type", nullable = false)
    private SenderType senderType = SenderType.CONTACT;

    @Column(name = "sender_user_id")
    private UUID senderUserId;

    @Column(name = "body", nullable = false)
    private String body;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "attachments", nullable = false)
    private JsonNode attachments;

    @Column(name = "provider_message_id")
    private String providerMessageId;

    @Column(name = "status", nullable = false)
    private String status = "SENT";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (body == null) {
            body = "";
        }
    }
}
