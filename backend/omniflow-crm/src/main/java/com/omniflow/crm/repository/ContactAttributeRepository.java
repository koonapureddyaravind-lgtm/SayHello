package com.omniflow.crm.repository;

import com.omniflow.crm.domain.ContactAttribute;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ContactAttributeRepository extends JpaRepository<ContactAttribute, UUID> {

    List<ContactAttribute> findByOrganizationIdOrderByAttributeKeyAsc(UUID organizationId);

    Optional<ContactAttribute> findByIdAndOrganizationId(UUID id, UUID organizationId);

    boolean existsByOrganizationIdAndAttributeKeyIgnoreCase(UUID organizationId, String attributeKey);
}
