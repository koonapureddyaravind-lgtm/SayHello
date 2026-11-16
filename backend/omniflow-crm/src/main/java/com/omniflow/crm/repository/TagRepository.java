package com.omniflow.crm.repository;

import com.omniflow.crm.domain.Tag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TagRepository extends JpaRepository<Tag, UUID> {

    List<Tag> findByOrganizationIdOrderByName(UUID organizationId);

    Optional<Tag> findByIdAndOrganizationId(UUID id, UUID organizationId);

    Optional<Tag> findByOrganizationIdAndNameIgnoreCase(UUID organizationId, String name);

    boolean existsByOrganizationIdAndNameIgnoreCase(UUID organizationId, String name);

    long countByOrganizationId(UUID organizationId);
}
