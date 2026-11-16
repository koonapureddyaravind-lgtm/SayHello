package com.omniflow.organization.dto;

import com.omniflow.common.domain.enums.MembershipStatus;

public record UpdateMemberRequest(
        String role,
        MembershipStatus status
) {
}
