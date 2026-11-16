package com.omniflow.identity.dto;

import java.util.List;

public record MeResponse(
        UserView user,
        List<OrganizationView> organizations
) {
}
