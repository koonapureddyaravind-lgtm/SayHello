package com.omniflow.crm.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record ContactImportView(
        UUID id,
        UUID organizationId,
        String filename,
        String status,
        long fileSizeBytes,
        long uploadedBytes,
        int uploadedChunks,
        int totalChunks,
        String delimiter,
        List<String> columns,
        Map<String, String> mapping,
        Map<String, String> attributeMapping,
        List<String> tags,
        long estimatedTotalRows,
        long totalRows,
        long processedRows,
        long createdCount,
        long updatedCount,
        long skippedCount,
        long failedCount,
        long errorCount,
        Integer progressPercent,
        String lastError,
        Instant createdAt,
        Instant updatedAt,
        Instant startedAt,
        Instant completedAt
) {
}
