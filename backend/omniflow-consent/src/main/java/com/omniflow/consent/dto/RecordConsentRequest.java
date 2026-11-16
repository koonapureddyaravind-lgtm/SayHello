package com.omniflow.consent.dto;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.ConsentPurpose;
import com.omniflow.common.domain.enums.ConsentStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Map;
import java.util.UUID;

public record RecordConsentRequest(
        @NotNull UUID contactId,
        @NotNull Channel channel,
        ConsentPurpose purpose,
        @NotNull ConsentStatus status,
        @NotBlank @Size(max = 64) String source,
        Map<String, Object> evidence
) {
}
