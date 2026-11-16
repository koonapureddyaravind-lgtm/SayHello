package com.omniflow.automation.repository;

import com.omniflow.automation.domain.Workflow;
import com.omniflow.common.domain.enums.WorkflowStatus;
import com.omniflow.common.domain.enums.WorkflowTriggerType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkflowRepository extends JpaRepository<Workflow, UUID> {

    Optional<Workflow> findByIdAndOrganizationIdAndDeletedAtIsNull(UUID id, UUID organizationId);

    Page<Workflow> findByOrganizationIdAndDeletedAtIsNull(UUID organizationId, Pageable pageable);

    Page<Workflow> findByOrganizationIdAndStatusAndDeletedAtIsNull(UUID organizationId,
                                                                  WorkflowStatus status,
                                                                  Pageable pageable);

    @Query("""
            select w from Workflow w
            where w.organizationId = :organizationId
              and w.deletedAt is null
              and (:status is null or w.status = :status)
              and (lower(w.name) like :q or lower(coalesce(w.description, '')) like :q)
            """)
    Page<Workflow> search(@Param("organizationId") UUID organizationId,
                          @Param("status") WorkflowStatus status,
                          @Param("q") String q,
                          Pageable pageable);

    List<Workflow> findByOrganizationIdAndStatusAndTriggerTypeAndDeletedAtIsNull(
            UUID organizationId, WorkflowStatus status, WorkflowTriggerType triggerType);
}
