package com.omniflow.identity.dto;

import java.util.List;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        UserView user,
        List<OrganizationView> organizations
) {
}
