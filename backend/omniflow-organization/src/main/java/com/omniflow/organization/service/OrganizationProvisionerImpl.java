package com.omniflow.organization.service;

import com.omniflow.common.domain.enums.MembershipStatus;
import com.omniflow.common.domain.enums.OrganizationStatus;
import com.omniflow.common.domain.enums.OrganizationType;
import com.omniflow.common.port.OrganizationProvisioner;
import com.omniflow.organization.entity.Membership;
import com.omniflow.organization.entity.Organization;
import com.omniflow.organization.entity.Role;
import com.omniflow.organization.repository.MembershipRepository;
import com.omniflow.organization.repository.OrganizationRepository;
import com.omniflow.organization.repository.RoleRepository;
import com.omniflow.organization.util.RoleCodes;
import com.omniflow.organization.util.SlugUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.UUID;

@Service
public class OrganizationProvisionerImpl implements OrganizationProvisioner {

    private static final UUID FREE_PLAN_ID =
            UUID.fromString("20000000-0000-0000-0000-000000000005");

    private final OrganizationRepository organizationRepository;
    private final MembershipRepository membershipRepository;
    private final RoleRepository roleRepository;

    public OrganizationProvisionerImpl(OrganizationRepository organizationRepository,
                                       MembershipRepository membershipRepository,
                                       RoleRepository roleRepository) {
        this.organizationRepository = organizationRepository;
        this.membershipRepository = membershipRepository;
        this.roleRepository = roleRepository;
    }

    @Override
    @Transactional
    public UUID provisionOrganization(String name, String slug, OrganizationType type, UUID ownerUserId) {
        Organization organization = new Organization();
        organization.setName(name);
        organization.setSlug(SlugUtils.uniqueSlug(
                slug == null || slug.isBlank() ? name : slug, organizationRepository));
        organization.setType(type == null ? OrganizationType.BUSINESS : type);
        organization.setStatus(OrganizationStatus.TRIAL);
        organization.setPlanId(FREE_PLAN_ID);
        organization.setTimezone("UTC");
        organization.setSettings(new HashMap<>());
        organization = organizationRepository.save(organization);

        Role ownerRole = roleRepository.findByCode(RoleCodes.OWNER)
                .orElseThrow(() -> new IllegalStateException("OWNER role is not seeded"));

        Instant now = Instant.now();
        Membership membership = new Membership();
        membership.setOrganizationId(organization.getId());
        membership.setUserId(ownerUserId);
        membership.setRoleId(ownerRole.getId());
        membership.setStatus(MembershipStatus.ACTIVE);
        membership.setInvitedBy(ownerUserId);
        membership.setInvitedAt(now);
        membership.setAcceptedAt(now);
        membershipRepository.save(membership);

        return organization.getId();
    }
}
