package com.omniflow.inbox.repository;

import com.omniflow.common.domain.enums.Direction;
import com.omniflow.inbox.domain.ConversationMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, UUID> {

    @Query("""
            select m from ConversationMessage m
            where m.conversationId = :conversationId
              and m.organizationId = :organizationId
            order by m.createdAt desc
            """)
    Page<ConversationMessage> findPage(@Param("conversationId") UUID conversationId,
                                       @Param("organizationId") UUID organizationId,
                                       Pageable pageable);

    boolean existsByOrganizationIdAndProviderMessageId(UUID organizationId, String providerMessageId);

    long countByConversationIdAndDirection(UUID conversationId, Direction direction);

    void deleteByConversationId(UUID conversationId);
}
