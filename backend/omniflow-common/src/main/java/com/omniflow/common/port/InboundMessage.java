package com.omniflow.common.port;

import com.omniflow.common.domain.enums.Channel;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record InboundMessage(
        UUID organizationId,
        UUID providerAccountId,
        Channel channel,
        String fromAddress,
        String toAddress,
        String contactProviderId,
        String subject,
        String body,
        Map<String, Object> payload,
        Instant occurredAt
) {
}
