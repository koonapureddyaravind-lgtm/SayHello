package com.omniflow.inbox.dto;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.ConversationStatus;
import com.omniflow.inbox.domain.Conversation;

import java.time.Instant;
import java.util.UUID;

public record ConversationView(
        UUID id,
        UUID contactId,
        String contactName,
        String contactAddress,
        Channel channel,
        UUID providerAccountId,
        ConversationStatus status,
        String subject,
        UUID assigneeUserId,
        Instant lastMessageAt,
        int unreadCount,
        String lastMessagePreview,
        Instant createdAt,
        Instant updatedAt
) {
    public static ConversationView of(Conversation conversation,
                                      String contactName,
                                      String contactAddress,
                                      String lastMessagePreview) {
        return new ConversationView(
                conversation.getId(),
                conversation.getContactId(),
                contactName,
                contactAddress,
                conversation.getChannel(),
                conversation.getProviderAccountId(),
                conversation.getStatus(),
                conversation.getSubject(),
                conversation.getAssigneeUserId(),
                conversation.getLastMessageAt(),
                conversation.getUnreadCount(),
                lastMessagePreview,
                conversation.getCreatedAt(),
                conversation.getUpdatedAt()
        );
    }
}
