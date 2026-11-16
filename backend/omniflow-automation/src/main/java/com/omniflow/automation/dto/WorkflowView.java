package com.omniflow.automation.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.omniflow.automation.domain.Workflow;
import com.omniflow.common.domain.enums.WorkflowStatus;
import com.omniflow.common.domain.enums.WorkflowTriggerType;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record WorkflowView(
        UUID id,
        String name,
        String description,
        WorkflowStatus status,
        WorkflowTriggerType triggerType,
        Map<String, Object> triggerConfig,
        int currentVersion,
        UUID createdBy,
        Instant createdAt,
        Instant updatedAt,
        JsonNode graph
) {
    public static WorkflowView of(Workflow workflow, JsonNode graph) {
        return new WorkflowView(
                workflow.getId(),
                workflow.getName(),
                workflow.getDescription(),
                workflow.getStatus(),
                workflow.getTriggerType(),
                workflow.getTriggerConfig(),
                workflow.getCurrentVersion(),
                workflow.getCreatedBy(),
                workflow.getCreatedAt(),
                workflow.getUpdatedAt(),
                graph
        );
    }

    public static WorkflowView of(Workflow workflow) {
        return of(workflow, null);
    }
}
