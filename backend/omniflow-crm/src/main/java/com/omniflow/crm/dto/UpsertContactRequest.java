package com.omniflow.crm.dto;

import java.util.List;
import java.util.Map;

public record UpsertContactRequest(
        String email,
        String phone,
        String firstName,
        String lastName,
        String status,
        String source,
        Map<String, Object> attributes,
        List<String> tags
) {
}
