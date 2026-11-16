package com.omniflow.crm.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record ContactView(
        UUID id,
        String email,
        String phone,
        String firstName,
        String lastName,
        String status,
        String source,
        Map<String, Object> attributes,
        List<TagView> tags,
        Instant lastEngagementAt,
        Instant createdAt,
        Instant updatedAt,
        List<ActivityView> recentActivities
) {

    public ContactView(UUID id,
                       String email,
                       String phone,
                       String firstName,
                       String lastName,
                       String status,
                       String source,
                       Map<String, Object> attributes,
                       List<TagView> tags,
                       Instant lastEngagementAt,
                       Instant createdAt,
                       Instant updatedAt) {
        this(id, email, phone, firstName, lastName, status, source, attributes, tags,
                lastEngagementAt, createdAt, updatedAt, List.of());
    }

    public ContactView {
        attributes = attributes == null ? Map.of() : attributes;
        tags = tags == null ? List.of() : List.copyOf(tags);
        recentActivities = recentActivities == null ? List.of() : List.copyOf(recentActivities);
    }
}
