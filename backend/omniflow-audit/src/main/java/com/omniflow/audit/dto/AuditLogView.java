package com.omniflow.audit.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record AuditLogView(
        UUID id,
        UUID organizationId,
        UUID actorUserId,
        String action,
        String entityType,
        String entityId,
        Map<String, Object> beforeState,
        Map<String, Object> afterState,
        String ipAddress,
        String userAgent,
        Instant createdAt
) {
}
