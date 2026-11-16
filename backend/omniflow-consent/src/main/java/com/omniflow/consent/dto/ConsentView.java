package com.omniflow.consent.dto;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.ConsentPurpose;
import com.omniflow.common.domain.enums.ConsentStatus;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record ConsentView(
        UUID id,
        UUID contactId,
        Channel channel,
        ConsentPurpose purpose,
        ConsentStatus status,
        String source,
        String ipAddress,
        Map<String, Object> evidence,
        Instant occurredAt,
        Instant createdAt
) {
    public ConsentView {
        evidence = evidence == null ? Map.of() : evidence;
    }
}
