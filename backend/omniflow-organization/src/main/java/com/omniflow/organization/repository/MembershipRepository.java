package com.omniflow.organization.repository;

import com.omniflow.common.domain.enums.MembershipStatus;
import com.omniflow.organization.entity.Membership;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MembershipRepository extends JpaRepository<Membership, UUID> {

    Optional<Membership> findByOrganizationIdAndUserId(UUID organizationId, UUID userId);

    boolean existsByOrganizationIdAndUserId(UUID organizationId, UUID userId);

    boolean existsByOrganizationIdAndUserIdAndStatus(UUID organizationId, UUID userId, MembershipStatus status);

    List<Membership> findByOrganizationId(UUID organizationId);

    List<Membership> findByUserId(UUID userId);

    Optional<Membership> findByIdAndOrganizationId(UUID id, UUID organizationId);

    void deleteByOrganizationIdAndUserId(UUID organizationId, UUID userId);

    long countByOrganizationIdAndRoleIdAndStatus(UUID organizationId, UUID roleId, MembershipStatus status);
}
