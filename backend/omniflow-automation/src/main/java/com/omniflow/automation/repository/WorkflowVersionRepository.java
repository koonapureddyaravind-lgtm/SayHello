package com.omniflow.automation.repository;

import com.omniflow.automation.domain.WorkflowVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface WorkflowVersionRepository extends JpaRepository<WorkflowVersion, UUID> {

    Optional<WorkflowVersion> findFirstByWorkflowIdOrderByVersionDesc(UUID workflowId);

    Optional<WorkflowVersion> findByWorkflowIdAndVersion(UUID workflowId, int version);
}
