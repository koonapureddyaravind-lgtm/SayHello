package com.omniflow.common.port;

import java.util.Map;
import java.util.UUID;

public interface AuditPort {

    void record(UUID organizationId,
                UUID actorUserId,
                String action,
                String entityType,
                String entityId,
                Map<String, Object> before,
                Map<String, Object> after);
}
