package com.omniflow.common.port;

import com.omniflow.common.domain.enums.Channel;

import java.util.Map;
import java.util.UUID;

public record ContactInfo(
        UUID id,
        UUID organizationId,
        String email,
        String phone,
        String firstName,
        String lastName,
        String status,
        Map<String, Object> attributes
) {
    public String displayName() {
        String name = ((firstName == null ? "" : firstName) + " " + (lastName == null ? "" : lastName)).trim();
        if (!name.isBlank()) {
            return name;
        }
        return email != null ? email : phone;
    }

    public String addressFor(Channel channel) {
        return channel == com.omniflow.common.domain.enums.Channel.EMAIL ? email : phone;
    }
}
