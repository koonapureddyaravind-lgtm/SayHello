package com.omniflow.crm.repository;

import com.omniflow.crm.domain.ContactImport;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ContactImportRepository extends JpaRepository<ContactImport, UUID> {

    Optional<ContactImport> findByIdAndOrganizationId(UUID id, UUID organizationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from ContactImport i where i.id = :id and i.organizationId = :orgId")
    Optional<ContactImport> findForUpdate(@Param("id") UUID id, @Param("orgId") UUID orgId);

    Page<ContactImport> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId, Pageable pageable);

    @Query("""
            select i.id from ContactImport i
            where i.status in ('QUEUED','RUNNING')
              and (i.lockedUntil is null or i.lockedUntil < :cutoff)
            order by i.createdAt
            """)
    List<UUID> findRecoverable(@Param("cutoff") Instant cutoff, Pageable pageable);

    List<ContactImport> findByStatusInAndUpdatedAtBeforeOrderByUpdatedAtAsc(
            List<String> statuses, Instant cutoff, Pageable pageable);
}
