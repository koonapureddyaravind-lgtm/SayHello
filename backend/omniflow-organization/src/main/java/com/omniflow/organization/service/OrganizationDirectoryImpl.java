package com.omniflow.organization.service;

import com.omniflow.common.domain.enums.OrganizationStatus;
import com.omniflow.common.domain.enums.OrganizationType;
import com.omniflow.common.port.OrganizationDirectory;
import com.omniflow.common.port.OrganizationSummary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class OrganizationDirectoryImpl implements OrganizationDirectory {

    private static final String SELECT_FOR_USER = """
            select o.id, o.name, o.slug, o.type, o.status, o.parent_organization_id, r.code as role
            from organizations o
            join memberships m on m.organization_id = o.id
            join roles r on r.id = m.role_id
            where m.user_id = ? and m.status = 'ACTIVE' and o.deleted_at is null
            """;

    private static final RowMapper<OrganizationSummary> SUMMARY_MAPPER = (rs, rowNum) ->
            new OrganizationSummary(
                    rs.getObject("id", UUID.class),
                    rs.getString("name"),
                    rs.getString("slug"),
                    OrganizationType.valueOf(rs.getString("type")),
                    OrganizationStatus.valueOf(rs.getString("status")),
                    rs.getString("role"),
                    rs.getObject("parent_organization_id", UUID.class));

    private final JdbcTemplate jdbcTemplate;

    public OrganizationDirectoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<OrganizationSummary> organizationsForUser(UUID userId) {
        return jdbcTemplate.query(SELECT_FOR_USER + " order by o.name asc", SUMMARY_MAPPER, userId);
    }

    @Override
    public Optional<OrganizationSummary> organizationForUser(UUID organizationId, UUID userId) {
        return jdbcTemplate.query(SELECT_FOR_USER + " and o.id = ?", SUMMARY_MAPPER, userId, organizationId)
                .stream()
                .findFirst();
    }

    @Override
    public Optional<OrganizationSummary> findOrganization(UUID organizationId) {
        String sql = """
                select o.id, o.name, o.slug, o.type, o.status, o.parent_organization_id,
                       cast(null as text) as role
                from organizations o
                where o.id = ? and o.deleted_at is null
                """;
        return jdbcTemplate.query(sql, SUMMARY_MAPPER, organizationId).stream().findFirst();
    }

    @Override
    public Optional<UUID> findIdBySlug(String slug) {
        return jdbcTemplate.queryForList(
                        "select id from organizations where slug = ? and deleted_at is null",
                        UUID.class,
                        slug)
                .stream()
                .findFirst();
    }
}
