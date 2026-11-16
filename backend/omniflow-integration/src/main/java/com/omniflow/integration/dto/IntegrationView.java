package com.omniflow.integration.dto;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.ProviderAccountStatus;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Public projection of a provider account. Credential values are never exposed.
 */
public record IntegrationView(
        UUID id,
        Channel channel,
        String provider,
        String name,
        ProviderAccountStatus status,
        String fromAddress,
        String fromName,
        boolean isDefault,
        Map<String, Object> config,
        boolean credentialsConfigured,
        Instant lastVerifiedAt,
        Instant createdAt
) {
}
