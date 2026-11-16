package com.omniflow.messaging.repository;

import com.omniflow.messaging.entity.MessageAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MessageAttemptRepository extends JpaRepository<MessageAttempt, UUID> {

    Optional<MessageAttempt> findTopByMessageIdOrderByAttemptNoDesc(UUID messageId);

    long countByMessageId(UUID messageId);
}
