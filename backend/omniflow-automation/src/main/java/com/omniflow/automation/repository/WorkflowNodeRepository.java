package com.omniflow.automation.repository;

import com.omniflow.automation.domain.WorkflowNode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WorkflowNodeRepository extends JpaRepository<WorkflowNode, UUID> {

    List<WorkflowNode> findByWorkflowVersionId(UUID workflowVersionId);

    void deleteByWorkflowVersionId(UUID workflowVersionId);
}
