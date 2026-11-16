package com.omniflow.common.outbox;

import com.omniflow.common.config.MessagingTopology;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Polls the transactional outbox and publishes events to RabbitMQ.
 * Enabled only in the worker (see omniflow.outbox.publisher.enabled).
 */
@Component
@ConditionalOnProperty(name = "omniflow.outbox.publisher.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OutboxPublisher {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisher.class);
    private static final int BATCH_SIZE = 100;

    private final OutboxEventRepository repository;
    private final RabbitTemplate rabbitTemplate;

    @Value("${omniflow.rabbit.exchange:" + MessagingTopology.EXCHANGE + "}")
    private String exchange;

    @Scheduled(fixedDelayString = "${omniflow.outbox.poll-interval-ms:2000}")
    @Transactional
    public void publishPending() {
        List<OutboxEvent> events = repository.lockPending(Instant.now(), PageRequest.of(0, BATCH_SIZE));
        if (events.isEmpty()) {
            return;
        }
        for (OutboxEvent event : events) {
            try {
                Map<String, Object> envelope = new LinkedHashMap<>();
                envelope.put("eventId", event.getId().toString());
                envelope.put("eventType", event.getEventType());
                envelope.put("occurredAt", event.getCreatedAt().toString());
                envelope.put("organizationId", event.getOrganizationId() == null ? null : event.getOrganizationId().toString());
                envelope.put("aggregateType", event.getAggregateType());
                envelope.put("aggregateId", event.getAggregateId() == null ? null : event.getAggregateId().toString());
                envelope.put("payload", event.getPayload());
                rabbitTemplate.convertAndSend(exchange, event.getEventType(), envelope);
                event.markPublished();
                log.debug("Published outbox event {} ({})", event.getId(), event.getEventType());
            } catch (Exception ex) {
                Instant retryAt = Instant.now().plus(Math.min(300, 5L * (event.getAttempts() + 1)), ChronoUnit.SECONDS);
                event.markFailed(ex.getMessage(), retryAt);
                log.warn("Failed to publish outbox event {}: {}", event.getId(), ex.getMessage());
            }
        }
    }
}
