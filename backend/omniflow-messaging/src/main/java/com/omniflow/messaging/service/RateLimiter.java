package com.omniflow.messaging.service;

import com.omniflow.common.domain.enums.Channel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.UUID;

/**
 * Fixed-window per-organization/per-channel rate limiter backed by Redis.
 * Fails open when Redis is unavailable so a cache outage cannot stop delivery.
 */
@Component
public class RateLimiter {

    private static final Logger log = LoggerFactory.getLogger(RateLimiter.class);

    private final StringRedisTemplate redisTemplate;
    private final long emailPerMinute;
    private final long whatsappPerMinute;
    private final long smsPerMinute;

    public RateLimiter(StringRedisTemplate redisTemplate,
                       @Value("${omniflow.rate-limit.email-per-minute:600}") long emailPerMinute,
                       @Value("${omniflow.rate-limit.whatsapp-per-minute:600}") long whatsappPerMinute,
                       @Value("${omniflow.rate-limit.sms-per-minute:600}") long smsPerMinute) {
        this.redisTemplate = redisTemplate;
        this.emailPerMinute = emailPerMinute;
        this.whatsappPerMinute = whatsappPerMinute;
        this.smsPerMinute = smsPerMinute;
    }

    public boolean tryAcquire(UUID organizationId, Channel channel) {
        if (organizationId == null || channel == null) {
            return true;
        }
        long limit = limitFor(channel);
        if (limit <= 0) {
            return true;
        }

        long epochMinute = System.currentTimeMillis() / 60000L;
        String key = "rl:" + channel.name() + ":" + organizationId + ":" + epochMinute;
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            if (count == null) {
                return true;
            }
            if (count == 1L) {
                redisTemplate.expire(key, Duration.ofSeconds(120));
            }
            return count <= limit;
        } catch (RuntimeException ex) {
            log.warn("Rate limiter unavailable, allowing send: {}", ex.getMessage());
            return true;
        }
    }

    private long limitFor(Channel channel) {
        return switch (channel) {
            case EMAIL -> emailPerMinute;
            case WHATSAPP -> whatsappPerMinute;
            case SMS -> smsPerMinute;
        };
    }
}
