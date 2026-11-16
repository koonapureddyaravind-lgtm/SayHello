package com.omniflow.messaging.dto;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.Direction;
import com.omniflow.common.domain.enums.MessageStatus;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record MessageView(
        UUID id,
        UUID organizationId,
        UUID campaignId,
        UUID contactId,
        Channel channel,
        UUID providerAccountId,
        Direction direction,
        String provider,
        String providerMessageId,
        String idempotencyKey,
        MessageStatus status,
        String subject,
        String body,
        String htmlBody,
        String toAddress,
        String fromAddress,
        String errorCode,
        String errorMessage,
        Instant scheduledAt,
        Instant queuedAt,
        Instant sentAt,
        Instant deliveredAt,
        Instant readAt,
        Instant failedAt,
        Map<String, Object> metadata,
        Instant createdAt,
        Instant updatedAt
) {
}
