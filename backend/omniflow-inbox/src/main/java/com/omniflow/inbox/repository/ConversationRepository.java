package com.omniflow.inbox.repository;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.ConversationStatus;
import com.omniflow.inbox.domain.Conversation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    Optional<Conversation> findByIdAndOrganizationId(UUID id, UUID organizationId);

    Optional<Conversation> findByOrganizationIdAndContactIdAndChannel(UUID organizationId,
                                                                      UUID contactId,
                                                                      Channel channel);

    @Query("""
            select c from Conversation c
            where c.organizationId = :organizationId
              and (:status is null or c.status = :status)
              and (:channel is null or c.channel = :channel)
              and (:assignee is null or c.assigneeUserId = :assignee)
              and (:q is null or lower(coalesce(c.subject, '')) like :q)
            order by c.lastMessageAt desc
            """)
    Page<Conversation> search(@Param("organizationId") UUID organizationId,
                              @Param("status") ConversationStatus status,
                              @Param("channel") Channel channel,
                              @Param("assignee") UUID assignee,
                              @Param("q") String q,
                              Pageable pageable);
}
