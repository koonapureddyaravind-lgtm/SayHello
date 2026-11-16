package com.omniflow.automation.dto;

import com.omniflow.automation.domain.WorkflowExecution;
import com.omniflow.common.domain.enums.ExecutionStatus;

import java.time.Instant;
import java.util.UUID;

public record ExecutionView(
        UUID id,
        UUID workflowId,
        UUID workflowVersionId,
        UUID contactId,
        ExecutionStatus status,
        String currentNodeKey,
        Instant nextRunAt,
        String errorMessage,
        Instant startedAt,
        Instant finishedAt,
        Instant createdAt
) {
    public static ExecutionView of(WorkflowExecution execution) {
        return new ExecutionView(
                execution.getId(),
                execution.getWorkflowId(),
                execution.getWorkflowVersionId(),
                execution.getContactId(),
                execution.getStatus(),
                execution.getCurrentNodeKey(),
                execution.getNextRunAt(),
                execution.getErrorMessage(),
                execution.getStartedAt(),
                execution.getFinishedAt(),
                execution.getCreatedAt()
        );
    }
}
