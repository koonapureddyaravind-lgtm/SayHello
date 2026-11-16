package com.omniflow.automation.repository;

import com.omniflow.automation.domain.WorkflowExecutionStep;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WorkflowExecutionStepRepository extends JpaRepository<WorkflowExecutionStep, UUID> {

    List<WorkflowExecutionStep> findByExecutionIdOrderByStartedAt(UUID executionId);

    void deleteByExecutionId(UUID executionId);
}
