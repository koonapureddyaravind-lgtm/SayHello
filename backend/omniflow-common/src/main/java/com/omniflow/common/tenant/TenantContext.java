package com.omniflow.common.tenant;

import java.util.Optional;
import java.util.UUID;

/**
 * Holds the active organization for the current request thread.
 * Always cleared by the tenant filter in a finally block.
 */
public final class TenantContext {

    private static final ThreadLocal<UUID> ORGANIZATION = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void setOrganizationId(UUID organizationId) {
        ORGANIZATION.set(organizationId);
    }

    public static Optional<UUID> getOrganizationId() {
        return Optional.ofNullable(ORGANIZATION.get());
    }

    public static void clear() {
        ORGANIZATION.remove();
    }
}
