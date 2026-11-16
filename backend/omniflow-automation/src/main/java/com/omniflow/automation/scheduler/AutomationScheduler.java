package com.omniflow.automation.scheduler;

import com.omniflow.automation.domain.WorkflowExecution;
import com.omniflow.automation.repository.WorkflowExecutionRepository;
import com.omniflow.automation.service.AutomationEngine;
import com.omniflow.common.domain.enums.ExecutionStatus;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * Resumes WAITING executions whose next_run_at has elapsed.
 */
@Component
@Profile("worker")
@RequiredArgsConstructor
public class AutomationScheduler {

    private static final Logger log = LoggerFactory.getLogger(AutomationScheduler.class);
    private static final int BATCH_SIZE = 50;

    private final WorkflowExecutionRepository executionRepository;
    private final AutomationEngine automationEngine;

    @Scheduled(fixedDelay = 30000)
    public void resumeWaitingExecutions() {
        List<WorkflowExecution> due = executionRepository.findDueWaiting(
                ExecutionStatus.WAITING, Instant.now(), PageRequest.of(0, BATCH_SIZE));
        for (WorkflowExecution execution : due) {
            try {
                automationEngine.resume(execution.getId());
            } catch (RuntimeException ex) {
                log.warn("Failed to resume workflow execution {}: {}",
                        execution.getId(), ex.getMessage());
            }
        }
    }
}
