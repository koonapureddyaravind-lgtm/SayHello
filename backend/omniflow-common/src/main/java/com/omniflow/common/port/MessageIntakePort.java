package com.omniflow.common.port;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public interface MessageIntakePort {

    /**
     * Persists a QUEUED message and writes a message.send outbox event atomically.
     * Idempotent on {@code command.getIdempotencyKey()}.
     */
    UUID enqueue(OutboundMessageCommand command);
}
