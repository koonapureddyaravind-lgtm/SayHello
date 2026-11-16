package com.omniflow.messaging.repository;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.MessageStatus;
import com.omniflow.messaging.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    Optional<Message> findByIdAndOrganizationId(UUID id, UUID organizationId);

    Optional<Message> findByProviderAndProviderMessageId(String provider, String providerMessageId);

    boolean existsByIdempotencyKey(String idempotencyKey);

    Optional<Message> findByIdempotencyKey(String idempotencyKey);

    @Query("""
            select m from Message m
            where m.organizationId = :organizationId
              and (:channel is null or m.channel = :channel)
              and (:status is null or m.status = :status)
              and (:campaignId is null or m.campaignId = :campaignId)
              and (:contactId is null or m.contactId = :contactId)
            order by m.createdAt desc
            """)
    Page<Message> search(@Param("organizationId") UUID organizationId,
                         @Param("channel") Channel channel,
                         @Param("status") MessageStatus status,
                         @Param("campaignId") UUID campaignId,
                         @Param("contactId") UUID contactId,
                         Pageable pageable);
}
