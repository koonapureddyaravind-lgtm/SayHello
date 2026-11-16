package com.omniflow.common.port;

import com.omniflow.common.domain.enums.Channel;

import java.util.Map;
import java.util.UUID;

public record ProviderAccountInfo(
        UUID id,
        UUID organizationId,
        Channel channel,
        String provider,
        String name,
        String fromAddress,
        String fromName,
        Map<String, String> credentials,
        Map<String, Object> config,
        boolean defaultAccount
) {
}
