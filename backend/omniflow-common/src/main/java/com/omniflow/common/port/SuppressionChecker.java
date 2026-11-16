package com.omniflow.common.port;

import com.omniflow.common.domain.enums.Channel;

import java.util.UUID;

public interface SuppressionChecker {

    boolean isSuppressed(UUID organizationId, String email, String phone, Channel channel);
}
