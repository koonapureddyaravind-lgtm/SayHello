package com.omniflow.inbox.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.omniflow.common.domain.enums.Direction;
import com.omniflow.common.domain.enums.SenderType;
import com.omniflow.inbox.domain.ConversationMessage;

import java.time.Instant;
import java.util.UUID;

public record ConversationMessageView(
        UUID id,
        UUID conversationId,
        Direction direction,
        SenderType senderType,
        UUID senderUserId,
        String body,
        JsonNode attachments,
        String providerMessageId,
        String status,
        Instant createdAt
) {
    public static ConversationMessageView of(ConversationMessage message) {
        return new ConversationMessageView(
                message.getId(),
                message.getConversationId(),
                message.getDirection(),
                message.getSenderType(),
                message.getSenderUserId(),
                message.getBody(),
                message.getAttachments(),
                message.getProviderMessageId(),
                message.getStatus(),
                message.getCreatedAt()
        );
    }
}
