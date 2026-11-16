package com.omniflow.crm.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Opens a chunked upload session. The browser splits large CSV files into
 * deterministic parts so a failed upload can be retried without restarting.
 */
public record CreateContactImportRequest(
        @NotBlank @Size(max = 500) String filename,
        @Min(0) long sizeBytes,
        @Min(1) int totalChunks
) {
}
