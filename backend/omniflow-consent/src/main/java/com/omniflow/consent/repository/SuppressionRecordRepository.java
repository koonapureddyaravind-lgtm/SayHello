package com.omniflow.consent.repository;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.consent.domain.SuppressionRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SuppressionRecordRepository extends JpaRepository<SuppressionRecord, UUID> {

    Page<SuppressionRecord> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId, Pageable pageable);

    Optional<SuppressionRecord> findByIdAndOrganizationId(UUID id, UUID organizationId);

    @Query("""
            select count(s) from SuppressionRecord s
            where s.organizationId = :orgId
              and (s.expiresAt is null or s.expiresAt > :now)
              and (s.channel is null or s.channel = :channel)
              and ((:email is not null and lower(s.email) = lower(:email))
                   or (:phone is not null and s.phone = :phone))
            """)
    long countActive(@Param("orgId") UUID organizationId,
                     @Param("email") String email,
                     @Param("phone") String phone,
                     @Param("channel") Channel channel,
                     @Param("now") Instant now);

    @Query("""
            select s from SuppressionRecord s
            where s.organizationId = :orgId
              and ((:channel is null and s.channel is null) or s.channel = :channel)
              and ((:email is null and s.email is null) or lower(s.email) = lower(:email))
              and ((:phone is null and s.phone is null) or s.phone = :phone)
            order by s.createdAt asc
            """)
    List<SuppressionRecord> findMatching(@Param("orgId") UUID organizationId,
                                         @Param("email") String email,
                                         @Param("phone") String phone,
                                         @Param("channel") Channel channel);
}
