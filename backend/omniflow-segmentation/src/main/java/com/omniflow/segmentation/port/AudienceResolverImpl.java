package com.omniflow.segmentation.port;

import com.omniflow.common.domain.enums.SegmentType;
import com.omniflow.common.exception.NotFoundException;
import com.omniflow.common.port.AudienceResolver;
import com.omniflow.segmentation.domain.Segment;
import com.omniflow.segmentation.query.SegmentQueryBuilder;
import com.omniflow.segmentation.repository.SegmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AudienceResolverImpl implements AudienceResolver {

    private final SegmentRepository segmentRepository;
    private final SegmentQueryBuilder queryBuilder;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    @Override
    public List<UUID> resolveContactIds(UUID organizationId, UUID segmentId, int limit, int offset) {
        Segment segment = requireSegment(organizationId, segmentId);
        if (segment.getType() == SegmentType.STATIC) {
            return staticContactIds(organizationId, segmentId, limit, offset);
        }

        SegmentQueryBuilder.Compiled compiled =
                queryBuilder.compile(organizationId, segment.getRules(), segment.getMatchType());
        Map<String, Object> parameters = new LinkedHashMap<>(compiled.parameters());
        parameters.put("limit", Math.max(0, limit));
        parameters.put("offset", Math.max(0, offset));

        String sql = "select c.id from contacts c where " + dynamicWhere(compiled)
                + " order by c.created_at asc limit :limit offset :offset";
        return jdbcTemplate.queryForList(sql, parameters, UUID.class);
    }

    @Override
    public long count(UUID organizationId, UUID segmentId) {
        Segment segment = requireSegment(organizationId, segmentId);
        if (segment.getType() == SegmentType.STATIC) {
            Long count = jdbcTemplate.queryForObject("""
                    select count(*)
                    from segment_members sm
                    join contacts c on c.id = sm.contact_id
                    where sm.segment_id = :segmentId
                      and c.organization_id = :orgId
                      and c.deleted_at is null
                    """, Map.of("segmentId", segmentId, "orgId", organizationId), Long.class);
            return count == null ? 0 : count;
        }

        SegmentQueryBuilder.Compiled compiled =
                queryBuilder.compile(organizationId, segment.getRules(), segment.getMatchType());
        Long count = jdbcTemplate.queryForObject(
                "select count(*) from contacts c where " + dynamicWhere(compiled),
                compiled.parameters(), Long.class);
        return count == null ? 0 : count;
    }

    @Override
    public List<UUID> sampleContactIds(UUID organizationId, UUID segmentId, int limit) {
        return resolveContactIds(organizationId, segmentId, limit, 0);
    }

    private String dynamicWhere(SegmentQueryBuilder.Compiled compiled) {
        return "c.organization_id = :orgId and c.deleted_at is null and c.status = 'ACTIVE' and ("
                + compiled.predicate() + ")";
    }

    private List<UUID> staticContactIds(UUID organizationId, UUID segmentId, int limit, int offset) {
        return jdbcTemplate.queryForList("""
                select c.id
                from segment_members sm
                join contacts c on c.id = sm.contact_id
                where sm.segment_id = :segmentId
                  and c.organization_id = :orgId
                  and c.deleted_at is null
                order by c.created_at asc
                limit :limit offset :offset
                """, Map.of(
                        "segmentId", segmentId,
                        "orgId", organizationId,
                        "limit", Math.max(0, limit),
                        "offset", Math.max(0, offset)), UUID.class);
    }

    private Segment requireSegment(UUID organizationId, UUID segmentId) {
        return segmentRepository.findByIdAndOrganizationIdAndDeletedAtIsNull(segmentId, organizationId)
                .orElseThrow(() -> new NotFoundException("Segment", segmentId));
    }
}
