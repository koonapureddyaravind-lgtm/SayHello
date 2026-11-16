package com.omniflow.common.port;

import java.util.List;
import java.util.UUID;

public interface AudienceResolver {

    List<UUID> resolveContactIds(UUID organizationId, UUID segmentId, int limit, int offset);

    long count(UUID organizationId, UUID segmentId);

    List<UUID> sampleContactIds(UUID organizationId, UUID segmentId, int limit);
}
