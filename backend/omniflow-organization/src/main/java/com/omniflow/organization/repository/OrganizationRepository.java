package com.omniflow.organization.repository;

import com.omniflow.organization.entity.Organization;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrganizationRepository extends JpaRepository<Organization, UUID> {

    Optional<Organization> findByIdAndDeletedAtIsNull(UUID id);

    boolean existsBySlug(String slug);

    List<Organization> findByParentOrganizationIdAndDeletedAtIsNull(UUID parentOrganizationId);
}
