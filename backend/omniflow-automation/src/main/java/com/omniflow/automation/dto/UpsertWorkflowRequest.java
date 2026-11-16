package com.omniflow.automation.dto;

import com.omniflow.common.domain.enums.WorkflowTriggerType;
import jakarta.validation.constraints.Size;

import java.util.Map;

/**
 * Create/update payload. On PATCH any field may be null; on POST {@code name} is required
 * (validated in the service so the same record can serve both operations).
 */
public record UpsertWorkflowRequest(
        @Size(max = 200) String name,
        @Size(max = 2000) String description,
        WorkflowTriggerType triggerType,
        Map<String, Object> triggerConfig
) {
}
