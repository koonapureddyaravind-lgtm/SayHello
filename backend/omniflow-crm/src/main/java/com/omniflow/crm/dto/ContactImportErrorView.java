package com.omniflow.crm.dto;

import java.time.Instant;

public record ContactImportErrorView(
        long rowNumber,
        String message,
        Instant createdAt
) {
}
