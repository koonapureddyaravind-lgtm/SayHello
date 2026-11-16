package com.omniflow.common.port;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrganizationDirectory {

    List<OrganizationSummary> organizationsForUser(UUID userId);

    Optional<OrganizationSummary> organizationForUser(UUID organizationId, UUID userId);

    Optional<OrganizationSummary> findOrganization(UUID organizationId);

    Optional<UUID> findIdBySlug(String slug);
}
