package com.omniflow.common.port;

import com.omniflow.common.domain.enums.Channel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Request to persist and enqueue a single outbound message.
 */
@Getter
@Builder
@AllArgsConstructor
public class OutboundMessageCommand {

    private final UUID organizationId;
    private final UUID campaignId;
    private final UUID contactId;
    private final Channel channel;
    private final UUID templateId;
    private final String subject;
    private final String body;
    private final String htmlBody;
    private final String toAddress;
    private final String fromAddress;
    private final UUID providerAccountId;
    private final String idempotencyKey;
    private final Map<String, Object> metadata;
    private final Instant scheduledAt;
}
