package com.omniflow.organization.service;

import com.omniflow.common.domain.enums.MembershipStatus;
import com.omniflow.common.port.MembershipChecker;
import com.omniflow.organization.repository.MembershipRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
public class MembershipCheckerImpl implements MembershipChecker {

    private static final String ROLE_SQL = """
            select r.code
            from memberships m
            join roles r on r.id = m.role_id
            where m.organization_id = ? and m.user_id = ? and m.status = 'ACTIVE'
            """;

    private final MembershipRepository membershipRepository;
    private final JdbcTemplate jdbcTemplate;

    public MembershipCheckerImpl(MembershipRepository membershipRepository, JdbcTemplate jdbcTemplate) {
        this.membershipRepository = membershipRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public boolean isMember(UUID organizationId, UUID userId) {
        return membershipRepository.existsByOrganizationIdAndUserIdAndStatus(
                organizationId, userId, MembershipStatus.ACTIVE);
    }

    @Override
    public Optional<String> roleCode(UUID organizationId, UUID userId) {
        return jdbcTemplate.query(ROLE_SQL,
                rs -> rs.next() ? Optional.ofNullable(rs.getString("code")) : Optional.<String>empty(),
                organizationId,
                userId);
    }
}
