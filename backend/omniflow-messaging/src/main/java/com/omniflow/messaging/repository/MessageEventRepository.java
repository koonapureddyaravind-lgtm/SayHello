package com.omniflow.messaging.repository;

import com.omniflow.messaging.entity.MessageEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MessageEventRepository extends JpaRepository<MessageEvent, UUID> {

    List<MessageEvent> findByMessageIdAndOrganizationIdOrderByEventTimeDesc(UUID messageId, UUID organizationId);

    boolean existsByProviderAndProviderEventId(String provider, String providerEventId);

    Optional<MessageEvent> findByProviderAndProviderEventId(String provider, String providerEventId);
}
