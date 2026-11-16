package com.omniflow.crm.dto;

import com.omniflow.common.domain.enums.Channel;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record ActivityView(
        UUID id,
        String type,
        Channel channel,
        Map<String, Object> payload,
        Instant occurredAt
) {
    public ActivityView {
        payload = payload == null ? Map.of() : payload;
    }
}
