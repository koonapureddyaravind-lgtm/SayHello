package com.omniflow.crm.dto;

import java.util.List;
import java.util.Map;

public record JsonContactRow(
        String email,
        String phone,
        String firstName,
        String lastName,
        List<String> tags,
        Map<String, Object> attributes
) {
}
