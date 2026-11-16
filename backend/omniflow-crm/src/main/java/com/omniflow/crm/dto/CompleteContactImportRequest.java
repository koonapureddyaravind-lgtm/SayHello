package com.omniflow.crm.dto;

import java.util.List;
import java.util.Map;

/**
 * Finalises an upload. {@code mapping} maps canonical fields (email, phone,
 * firstName, lastName, status, tags, externalId) to CSV header names.
 * {@code attributeMapping} maps any remaining header to an attribute key.
 */
public record CompleteContactImportRequest(
        Map<String, String> mapping,
        Map<String, String> attributeMapping,
        List<String> tags,
        String sourceLabel,
        Boolean triggerAutomations,
        Boolean recordActivities,
        Integer batchSize
) {
}
