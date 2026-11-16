package com.omniflow.campaign.repository;

import com.omniflow.campaign.entity.Campaign;
import com.omniflow.common.domain.enums.CampaignStatus;
import com.omniflow.common.domain.enums.Channel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CampaignRepository extends JpaRepository<Campaign, UUID> {

    Optional<Campaign> findByIdAndOrganizationIdAndDeletedAtIsNull(UUID id, UUID organizationId);

    @Query("""
            select c from Campaign c
            where c.organizationId = :organizationId
              and c.deletedAt is null
              and (:status is null or c.status = :status)
              and (:channel is null or c.channel = :channel)
              and lower(c.name) like lower(concat('%', coalesce(:q, ''), '%'))
            order by c.createdAt desc
            """)
    Page<Campaign> search(@Param("organizationId") UUID organizationId,
                          @Param("status") CampaignStatus status,
                          @Param("channel") Channel channel,
                          @Param("q") String q,
                          Pageable pageable);

    @Query("""
            select c from Campaign c
            where c.status = com.omniflow.common.domain.enums.CampaignStatus.SCHEDULED
              and c.scheduledAt is not null
              and c.scheduledAt <= :now
              and c.deletedAt is null
            order by c.scheduledAt asc
            """)
    List<Campaign> findDueScheduled(@Param("now") Instant now, Pageable pageable);
}
