package com.omniflow.common.tenant;

import com.omniflow.common.exception.ForbiddenException;
import com.omniflow.common.security.SecurityUtils;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Resolves the validated active organization and current user for controllers/services.
 */
@Component
public class TenantGuard {

    public UUID currentOrganizationId() {
        return TenantContext.getOrganizationId()
                .orElseThrow(() -> new ForbiddenException("NO_ACTIVE_ORGANIZATION",
                        "Select an organization with the X-Organization-Id header"));
    }

    public UUID requireOrganization(UUID organizationId) {
        UUID current = currentOrganizationId();
        if (!current.equals(organizationId)) {
            throw new ForbiddenException("ORGANIZATION_MISMATCH",
                    "The requested resource belongs to another organization");
        }
        return organizationId;
    }

    public UUID currentUserId() {
        return SecurityUtils.currentUserId();
    }

    public UUID currentUserIdOrNull() {
        return SecurityUtils.currentUserIdOrNull();
    }
}
