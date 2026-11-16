package com.omniflow.automation.repository;

import com.omniflow.automation.domain.WorkflowExecution;
import com.omniflow.common.domain.enums.ExecutionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface WorkflowExecutionRepository extends JpaRepository<WorkflowExecution, UUID> {

    Page<WorkflowExecution> findByOrganizationIdAndWorkflowId(UUID organizationId,
                                                              UUID workflowId,
                                                              Pageable pageable);

    @Query("""
            select e from WorkflowExecution e
            where e.status = :status
              and e.nextRunAt is not null
              and e.nextRunAt <= :now
            order by e.nextRunAt asc
            """)
    List<WorkflowExecution> findDueWaiting(@Param("status") ExecutionStatus status,
                                           @Param("now") Instant now,
                                           Pageable pageable);
}
