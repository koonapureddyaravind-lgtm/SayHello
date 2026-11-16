package com.omniflow.segmentation.repository;

import com.omniflow.segmentation.domain.Segment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface SegmentRepository extends JpaRepository<Segment, UUID> {

    @Query("""
            select s from Segment s
            where s.organizationId = :orgId
              and s.deletedAt is null
              and (lower(s.name) like lower(concat('%', coalesce(:q, ''), '%'))
                   or lower(coalesce(s.description, '')) like lower(concat('%', coalesce(:q, ''), '%')))
            """)
    Page<Segment> search(@Param("orgId") UUID organizationId,
                         @Param("q") String q,
                         Pageable pageable);

    Optional<Segment> findByIdAndOrganizationIdAndDeletedAtIsNull(UUID id, UUID organizationId);
}
