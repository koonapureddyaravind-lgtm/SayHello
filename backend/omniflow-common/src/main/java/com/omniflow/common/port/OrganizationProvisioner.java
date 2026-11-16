package com.omniflow.common.port;

import com.omniflow.common.domain.enums.OrganizationType;

import java.util.UUID;

public interface OrganizationProvisioner {

    /**
     * Creates an organization, its default subscription and the owner membership.
     * Slug is made unique when blank or already taken.
     */
    UUID provisionOrganization(String name, String slug, OrganizationType type, UUID ownerUserId);
}
