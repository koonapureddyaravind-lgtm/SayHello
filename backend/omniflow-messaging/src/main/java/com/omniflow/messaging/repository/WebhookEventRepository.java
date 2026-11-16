package com.omniflow.messaging.repository;

import com.omniflow.messaging.entity.WebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface WebhookEventRepository extends JpaRepository<WebhookEvent, UUID> {

    boolean existsByProviderAndEventId(String provider, String eventId);

    Optional<WebhookEvent> findByProviderAndEventId(String provider, String eventId);
}
