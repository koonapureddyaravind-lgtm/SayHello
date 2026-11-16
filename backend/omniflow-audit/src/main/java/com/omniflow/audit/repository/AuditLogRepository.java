package com.omniflow.audit.repository;

import com.omniflow.audit.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    Page<AuditLog> findByOrganizationIdAndCreatedAtBetweenOrderByCreatedAtDesc(
            UUID organizationId, Instant from, Instant to, Pageable pageable);

    @Query("""
            select a from AuditLog a
            where a.organizationId = :organizationId
              and a.createdAt between :from and :to
              and (:action is null or a.action = :action)
              and (:entityType is null or a.entityType = :entityType)
            order by a.createdAt desc
            """)
    Page<AuditLog> search(@Param("organizationId") UUID organizationId,
                          @Param("from") Instant from,
                          @Param("to") Instant to,
                          @Param("action") String action,
                          @Param("entityType") String entityType,
                          Pageable pageable);
}
