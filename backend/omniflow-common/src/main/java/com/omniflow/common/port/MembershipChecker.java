package com.omniflow.common.port;

import java.util.Optional;
import java.util.UUID;

public interface MembershipChecker {

    boolean isMember(UUID organizationId, UUID userId);

    Optional<String> roleCode(UUID organizationId, UUID userId);
}
