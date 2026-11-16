package com.omniflow.messaging.service;

/**
 * Thrown when the per-organization channel rate limit is exhausted. The listener
 * lets it bubble so the broker retries with backoff.
 */
public class RateLimitExceededException extends RuntimeException {

    public RateLimitExceededException(String message) {
        super(message);
    }
}
