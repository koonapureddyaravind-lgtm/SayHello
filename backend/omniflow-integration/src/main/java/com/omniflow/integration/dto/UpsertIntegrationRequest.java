package com.omniflow.integration.dto;

import com.omniflow.common.domain.enums.Channel;
import jakarta.validation.constraints.Size;

import java.util.Map;

/**
 * Create/update payload. Fields are optional on PATCH but validated by the service on create.
 */
public record UpsertIntegrationRequest(
        Channel channel,
        @Size(max = 64) String provider,
        @Size(max = 120) String name,
        Map<String, String> credentials,
        Map<String, Object> config,
        @Size(max = 320) String fromAddress,
        @Size(max = 120) String fromName,
        Boolean isDefault
) {
}
