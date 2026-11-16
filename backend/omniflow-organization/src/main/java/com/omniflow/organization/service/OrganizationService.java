package com.omniflow.organization.service;

import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.domain.enums.MembershipStatus;
import com.omniflow.common.domain.enums.OrganizationStatus;
import com.omniflow.common.domain.enums.OrganizationType;
import com.omniflow.common.exception.BadRequestException;
import com.omniflow.common.exception.ConflictException;
import com.omniflow.common.exception.ForbiddenException;
import com.omniflow.common.exception.NotFoundException;
import com.omniflow.common.port.MembershipChecker;
import com.omniflow.common.port.OrganizationDirectory;
import com.omniflow.common.port.OrganizationProvisioner;
import com.omniflow.common.port.OrganizationSummary;
import com.omniflow.common.port.UserDirectory;
import com.omniflow.common.port.UserSummary;
import com.omniflow.common.security.SecurityUtils;
import com.omniflow.organization.dto.MemberView;
import com.omniflow.organization.dto.OrganizationView;
import com.omniflow.organization.dto.WorkspaceView;
import com.omniflow.organization.entity.Membership;
import com.omniflow.organization.entity.Organization;
import com.omniflow.organization.entity.Role;
import com.omniflow.organization.repository.MembershipRepository;
import com.omniflow.organization.repository.OrganizationRepository;
import com.omniflow.organization.repository.RoleRepository;
import com.omniflow.organization.util.RoleCodes;
import com.omniflow.organization.util.SlugUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class OrganizationService {

    private static final UUID FREE_PLAN_ID =
            UUID.fromString("20000000-0000-0000-0000-000000000005");

    private static final String MEMBER_SELECT = """
            select m.id as membership_id,
                   m.user_id,
                   u.email,
                   u.full_name,
                   r.code as role,
                   m.status,
                   m.accepted_at,
                   m.created_at
            from memberships m
            join users u on u.id = m.user_id
            join roles r on r.id = m.role_id
            where m.organization_id = ?
            """;

    private final OrganizationRepository organizationRepository;
    private final MembershipRepository membershipRepository;
    private final RoleRepository roleRepository;
    private final OrganizationProvisioner organizationProvisioner;
    private final OrganizationDirectory organizationDirectory;
    private final MembershipChecker membershipChecker;
    private final UserDirectory userDirectory;
    private final JdbcTemplate jdbcTemplate;

    public OrganizationService(OrganizationRepository organizationRepository,
                               MembershipRepository membershipRepository,
                               RoleRepository roleRepository,
                               OrganizationProvisioner organizationProvisioner,
                               OrganizationDirectory organizationDirectory,
                               MembershipChecker membershipChecker,
                               UserDirectory userDirectory,
                               JdbcTemplate jdbcTemplate) {
        this.organizationRepository = organizationRepository;
        this.membershipRepository = membershipRepository;
        this.roleRepository = roleRepository;
        this.organizationProvisioner = organizationProvisioner;
        this.organizationDirectory = organizationDirectory;
        this.membershipChecker = membershipChecker;
        this.userDirectory = userDirectory;
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<OrganizationView> listMine() {
        UUID userId = SecurityUtils.currentUserId();
        List<OrganizationView> views = new ArrayList<>();
        for (OrganizationSummary summary : organizationDirectory.organizationsForUser(userId)) {
            organizationRepository.findByIdAndDeletedAtIsNull(summary.id())
                    .ifPresent(organization -> views.add(toView(organization)));
        }
        return views;
    }

    @Transactional
    public OrganizationView create(String name, String slug, OrganizationType type) {
        UUID userId = SecurityUtils.currentUserId();
        UUID organizationId = organizationProvisioner.provisionOrganization(
                name, slug, type == null ? OrganizationType.BUSINESS : type, userId);
        return toView(findActive(organizationId));
    }

    public OrganizationView get(UUID organizationId) {
        UUID userId = SecurityUtils.currentUserId();
        requireMembership(organizationId, userId);
        return toView(findActive(organizationId));
    }

    @Transactional
    public OrganizationView update(UUID organizationId,
                                   String name,
                                   String timezone,
                                   Map<String, Object> settings) {
        UUID userId = SecurityUtils.currentUserId();
        requireAdmin(organizationId, userId);

        Organization organization = findActive(organizationId);
        if (name != null && !name.isBlank()) {
            organization.setName(name.trim());
        }
        if (timezone != null && !timezone.isBlank()) {
            organization.setTimezone(timezone.trim());
        }
        if (settings != null) {
            organization.setSettings(settings);
        }
        organizationRepository.save(organization);
        return toView(organization);
    }

    public PageResponse<MemberView> listMembers(UUID organizationId, PageQuery pageQuery) {
        UUID userId = SecurityUtils.currentUserId();
        requireMembership(organizationId, userId);

        long offset = (long) pageQuery.page() * pageQuery.size();
        List<MemberView> items = jdbcTemplate.query(
                MEMBER_SELECT + " order by u.full_name asc nulls last, u.email asc limit ? offset ?",
                (rs, rowNum) -> new MemberView(
                        rs.getObject("membership_id", UUID.class),
                        rs.getObject("user_id", UUID.class),
                        rs.getString("email"),
                        rs.getString("full_name"),
                        rs.getString("role"),
                        MembershipStatus.valueOf(rs.getString("status")),
                        toInstant(rs.getTimestamp("accepted_at"), rs.getTimestamp("created_at"))),
                organizationId,
                pageQuery.size(),
                offset);

        Long total = jdbcTemplate.queryForObject(
                "select count(*) from memberships where organization_id = ?",
                Long.class,
                organizationId);
        long totalItems = total == null ? 0L : total;
        return PageResponse.of(items, pageQuery.page(), pageQuery.size(), totalItems);
    }

    @Transactional
    public MemberView addMember(UUID organizationId, String email, String roleCode) {
        UUID actorId = SecurityUtils.currentUserId();
        requireAdmin(organizationId, actorId);

        String normalizedRole = normalizeRole(roleCode);
        if (RoleCodes.PLATFORM_ADMIN.equals(normalizedRole)) {
            throw new ForbiddenException("ROLE_NOT_ALLOWED", "The PLATFORM_ADMIN role cannot be granted");
        }
        Role role = roleRepository.findByCode(normalizedRole)
                .orElseThrow(() -> new BadRequestException("UNKNOWN_ROLE", "Unknown role: " + roleCode));

        String normalizedEmail = normalizeEmail(email);
        Optional<UserSummary> existing = userDirectory.findByEmail(normalizedEmail);

        UUID memberUserId;
        String fullName;
        boolean invited;
        if (existing.isPresent()) {
            memberUserId = existing.get().id();
            fullName = existing.get().fullName() == null || existing.get().fullName().isBlank()
                    ? displayNameFromEmail(normalizedEmail)
                    : existing.get().fullName();
            invited = "INVITED".equalsIgnoreCase(existing.get().status());
        } else {
            fullName = displayNameFromEmail(normalizedEmail);
            memberUserId = userDirectory.createInvitedUser(normalizedEmail, fullName);
            invited = true;
        }

        if (membershipRepository.existsByOrganizationIdAndUserId(organizationId, memberUserId)) {
            throw new ConflictException("MEMBERSHIP_EXISTS",
                    "The user is already a member of this organization");
        }

        Instant now = Instant.now();
        Membership membership = new Membership();
        membership.setOrganizationId(organizationId);
        membership.setUserId(memberUserId);
        membership.setRoleId(role.getId());
        membership.setInvitedBy(actorId);
        membership.setInvitedAt(now);
        if (invited) {
            membership.setStatus(MembershipStatus.INVITED);
        } else {
            membership.setStatus(MembershipStatus.ACTIVE);
            membership.setAcceptedAt(now);
        }
        membership = membershipRepository.save(membership);

        return toMemberView(membership, normalizedEmail, fullName, role.getCode());
    }

    @Transactional
    public MemberView updateMemberRole(UUID organizationId,
                                       UUID membershipId,
                                       String roleCode,
                                       MembershipStatus status) {
        UUID actorId = SecurityUtils.currentUserId();
        requireAdmin(organizationId, actorId);

        if (roleCode == null && status == null) {
            throw new BadRequestException("NO_CHANGES", "Provide a role or status to update");
        }

        Membership membership = membershipRepository.findByIdAndOrganizationId(membershipId, organizationId)
                .orElseThrow(() -> new NotFoundException("Membership", membershipId));

        Role ownerRole = roleRepository.findByCode(RoleCodes.OWNER)
                .orElseThrow(() -> new IllegalStateException("OWNER role is not seeded"));

        Role newRole = null;
        if (roleCode != null) {
            String normalizedRole = normalizeRole(roleCode);
            if (RoleCodes.PLATFORM_ADMIN.equals(normalizedRole)) {
                throw new ForbiddenException("ROLE_NOT_ALLOWED", "The PLATFORM_ADMIN role cannot be granted");
            }
            newRole = roleRepository.findByCode(normalizedRole)
                    .orElseThrow(() -> new BadRequestException("UNKNOWN_ROLE", "Unknown role: " + roleCode));
        }

        UUID finalRoleId = newRole == null ? membership.getRoleId() : newRole.getId();
        MembershipStatus finalStatus = status == null ? membership.getStatus() : status;

        boolean wasActiveOwner = membership.getStatus() == MembershipStatus.ACTIVE
                && ownerRole.getId().equals(membership.getRoleId());
        boolean willBeActiveOwner = finalStatus == MembershipStatus.ACTIVE
                && ownerRole.getId().equals(finalRoleId);
        if (wasActiveOwner && !willBeActiveOwner) {
            requireAnotherActiveOwner(organizationId);
        }

        membership.setRoleId(finalRoleId);
        membership.setStatus(finalStatus);
        if (finalStatus == MembershipStatus.ACTIVE && membership.getAcceptedAt() == null) {
            membership.setAcceptedAt(Instant.now());
        }
        membership = membershipRepository.save(membership);

        String email = userDirectory.findById(membership.getUserId())
                .map(UserSummary::email)
                .orElse(null);
        String fullName = userDirectory.findById(membership.getUserId())
                .map(UserSummary::fullName)
                .orElse(null);
        String code = roleRepository.findById(membership.getRoleId())
                .map(Role::getCode)
                .orElse(null);

        return toMemberView(membership, email, fullName, code);
    }

    @Transactional
    public void removeMember(UUID organizationId, UUID membershipId) {
        UUID actorId = SecurityUtils.currentUserId();
        requireAdmin(organizationId, actorId);

        Membership membership = membershipRepository.findByIdAndOrganizationId(membershipId, organizationId)
                .orElseThrow(() -> new NotFoundException("Membership", membershipId));

        Role ownerRole = roleRepository.findByCode(RoleCodes.OWNER)
                .orElseThrow(() -> new IllegalStateException("OWNER role is not seeded"));
        boolean isActiveOwner = membership.getStatus() == MembershipStatus.ACTIVE
                && ownerRole.getId().equals(membership.getRoleId());
        if (isActiveOwner) {
            requireAnotherActiveOwner(organizationId);
        }

        membershipRepository.delete(membership);
    }

    public List<WorkspaceView> listWorkspaces(UUID parentOrganizationId) {
        UUID userId = SecurityUtils.currentUserId();
        requireMembership(parentOrganizationId, userId);

        return organizationRepository.findByParentOrganizationIdAndDeletedAtIsNull(parentOrganizationId)
                .stream()
                .sorted((left, right) -> left.getName().compareToIgnoreCase(right.getName()))
                .map(workspace -> new WorkspaceView(
                        workspace.getId(),
                        workspace.getName(),
                        workspace.getSlug(),
                        workspace.getType(),
                        workspace.getStatus(),
                        membershipChecker.roleCode(workspace.getId(), userId).orElse("NONE")))
                .toList();
    }

    @Transactional
    public WorkspaceView createWorkspace(UUID parentOrganizationId,
                                         String name,
                                         String slug,
                                         OrganizationType type) {
        UUID userId = SecurityUtils.currentUserId();
        OrganizationSummary parent = requireMembership(parentOrganizationId, userId);
        if (!canManageWorkspaces(parent.role())) {
            throw new ForbiddenException("INSUFFICIENT_ROLE",
                    "Only owners, admins and agency owners can create workspaces");
        }

        Organization workspace = new Organization();
        workspace.setName(name.trim());
        workspace.setSlug(SlugUtils.uniqueSlug(
                slug == null || slug.isBlank() ? name : slug, organizationRepository));
        workspace.setType(type == null ? OrganizationType.BUSINESS : type);
        workspace.setStatus(OrganizationStatus.TRIAL);
        workspace.setParentOrganizationId(parentOrganizationId);
        workspace.setPlanId(FREE_PLAN_ID);
        workspace.setTimezone("UTC");
        workspace.setSettings(new HashMap<>());
        workspace = organizationRepository.save(workspace);

        Role ownerRole = roleRepository.findByCode(RoleCodes.OWNER)
                .orElseThrow(() -> new IllegalStateException("OWNER role is not seeded"));

        Instant now = Instant.now();
        Membership membership = new Membership();
        membership.setOrganizationId(workspace.getId());
        membership.setUserId(userId);
        membership.setRoleId(ownerRole.getId());
        membership.setStatus(MembershipStatus.ACTIVE);
        membership.setInvitedBy(userId);
        membership.setInvitedAt(now);
        membership.setAcceptedAt(now);
        membershipRepository.save(membership);

        return new WorkspaceView(
                workspace.getId(),
                workspace.getName(),
                workspace.getSlug(),
                workspace.getType(),
                workspace.getStatus(),
                RoleCodes.OWNER);
    }

    private Organization findActive(UUID organizationId) {
        return organizationRepository.findByIdAndDeletedAtIsNull(organizationId)
                .orElseThrow(() -> new NotFoundException("Organization", organizationId));
    }

    private OrganizationSummary requireMembership(UUID organizationId, UUID userId) {
        return organizationDirectory.organizationForUser(organizationId, userId)
                .orElseThrow(() -> new ForbiddenException("NOT_A_MEMBER",
                        "You are not a member of this organization"));
    }

    private void requireAdmin(UUID organizationId, UUID userId) {
        OrganizationSummary membership = requireMembership(organizationId, userId);
        String role = membership.role();
        if (!RoleCodes.OWNER.equals(role) && !RoleCodes.ADMIN.equals(role)) {
            throw new ForbiddenException("INSUFFICIENT_ROLE",
                    "Only owners and admins can perform this action");
        }
    }

    private void requireAnotherActiveOwner(UUID organizationId) {
        Role ownerRole = roleRepository.findByCode(RoleCodes.OWNER)
                .orElseThrow(() -> new IllegalStateException("OWNER role is not seeded"));
        long activeOwners = membershipRepository.countByOrganizationIdAndRoleIdAndStatus(
                organizationId, ownerRole.getId(), MembershipStatus.ACTIVE);
        if (activeOwners <= 1) {
            throw new ConflictException("LAST_OWNER",
                    "The organization must retain at least one active owner");
        }
    }

    private boolean canManageWorkspaces(String role) {
        return RoleCodes.OWNER.equals(role)
                || RoleCodes.ADMIN.equals(role)
                || RoleCodes.AGENCY_OWNER.equals(role);
    }

    private OrganizationView toView(Organization organization) {
        return new OrganizationView(
                organization.getId(),
                organization.getName(),
                organization.getSlug(),
                organization.getType(),
                organization.getStatus(),
                organization.getParentOrganizationId(),
                organization.getTimezone(),
                organization.getCreatedAt());
    }

    private MemberView toMemberView(Membership membership,
                                    String email,
                                    String fullName,
                                    String roleCode) {
        Instant joinedAt = membership.getAcceptedAt() != null
                ? membership.getAcceptedAt()
                : membership.getCreatedAt();
        return new MemberView(
                membership.getId(),
                membership.getUserId(),
                email,
                fullName,
                roleCode,
                membership.getStatus(),
                joinedAt);
    }

    private Instant toInstant(Timestamp preferred, Timestamp fallback) {
        Timestamp value = preferred != null ? preferred : fallback;
        return value == null ? null : value.toInstant();
    }

    private String normalizeRole(String roleCode) {
        return roleCode == null ? "" : roleCode.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private String displayNameFromEmail(String email) {
        int at = email.indexOf('@');
        return at > 0 ? email.substring(0, at) : email;
    }
}
