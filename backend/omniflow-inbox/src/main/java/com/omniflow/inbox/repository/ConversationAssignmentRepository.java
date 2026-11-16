package com.omniflow.inbox.repository;

import com.omniflow.inbox.domain.ConversationAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ConversationAssignmentRepository extends JpaRepository<ConversationAssignment, UUID> {

    Optional<ConversationAssignment> findFirstByConversationIdAndUnassignedAtIsNullOrderByAssignedAtDesc(
            UUID conversationId);
}
