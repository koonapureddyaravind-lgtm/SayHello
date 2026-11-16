package com.omniflow.common.outbox;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * The only sanctioned way to emit business events. Writing the event in the same
 * transaction as the aggregate change guarantees at-least-once publication.
 */
@Service
@RequiredArgsConstructor
public class OutboxWriter {

    private final OutboxEventRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public void write(String aggregateType,
                      UUID aggregateId,
                      String eventType,
                      UUID organizationId,
                      Map<String, Object> payload) {
        write(aggregateType, aggregateId, eventType, organizationId, payload, Instant.now());
    }

    @Transactional
    public void write(String aggregateType,
                      UUID aggregateId,
                      String eventType,
                      UUID organizationId,
                      Map<String, Object> payload,
                      Instant availableAt) {
        OutboxEvent event = new OutboxEvent();
        event.setAggregateType(aggregateType);
        event.setAggregateId(aggregateId);
        event.setEventType(eventType);
        event.setOrganizationId(organizationId);
        event.setPayload(objectMapper.valueToTree(payload == null ? Map.of() : payload));
        event.setStatus("PENDING");
        event.setAvailableAt(availableAt == null ? Instant.now() : availableAt);
        repository.save(event);
    }
}
