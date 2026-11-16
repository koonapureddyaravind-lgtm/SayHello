package com.omniflow.consent.repository;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.ConsentPurpose;
import com.omniflow.consent.domain.ConsentRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ConsentRecordRepository extends JpaRepository<ConsentRecord, UUID> {

    @Query("""
            select r from ConsentRecord r
            where r.organizationId = :orgId
              and r.contactId = :contactId
              and r.channel = :channel
              and r.purpose = :purpose
            order by r.occurredAt desc, r.createdAt desc
            """)
    List<ConsentRecord> latestFor(@Param("orgId") UUID organizationId,
                                  @Param("contactId") UUID contactId,
                                  @Param("channel") Channel channel,
                                  @Param("purpose") ConsentPurpose purpose,
                                  Pageable pageable);

    @Query("""
            select r from ConsentRecord r
            where r.organizationId = :orgId
              and r.contactId = :contactId
              and r.channel = :channel
            order by r.occurredAt desc, r.createdAt desc
            """)
    List<ConsentRecord> latestForChannel(@Param("orgId") UUID organizationId,
                                         @Param("contactId") UUID contactId,
                                         @Param("channel") Channel channel,
                                         Pageable pageable);

    @Query("""
            select r from ConsentRecord r
            where r.organizationId = :orgId
              and (:contactId is null or r.contactId = :contactId)
              and (:channel is null or r.channel = :channel)
            order by r.occurredAt desc, r.createdAt desc
            """)
    Page<ConsentRecord> history(@Param("orgId") UUID organizationId,
                                @Param("contactId") UUID contactId,
                                @Param("channel") Channel channel,
                                Pageable pageable);
}
