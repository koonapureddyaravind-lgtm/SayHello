package com.omniflow.messaging.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record MessageEventView(
        UUID id,
        UUID messageId,
        String provider,
        String providerEventId,
        String eventType,
        Instant eventTime,
        Map<String, Object> payload,
        Instant processedAt,
        Instant createdAt
) {
}
