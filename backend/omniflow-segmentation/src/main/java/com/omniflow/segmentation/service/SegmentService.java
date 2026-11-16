package com.omniflow.segmentation.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.domain.enums.SegmentType;
import com.omniflow.common.exception.BadRequestException;
import com.omniflow.common.exception.NotFoundException;
import com.omniflow.common.port.AudienceResolver;
import com.omniflow.common.security.SecurityUtils;
import com.omniflow.crm.domain.Contact;
import com.omniflow.crm.dto.ContactView;
import com.omniflow.crm.repository.ContactRepository;
import com.omniflow.segmentation.domain.Segment;
import com.omniflow.segmentation.domain.SegmentRule;
import com.omniflow.segmentation.dto.PreviewRequest;
import com.omniflow.segmentation.dto.PreviewResult;
import com.omniflow.segmentation.dto.SegmentRuleDto;
import com.omniflow.segmentation.dto.SegmentView;
import com.omniflow.segmentation.dto.UpsertSegmentRequest;
import com.omniflow.segmentation.query.SegmentQueryBuilder;
import com.omniflow.segmentation.repository.SegmentRepository;
import com.omniflow.segmentation.repository.SegmentRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SegmentService {

    private static final int PREVIEW_SAMPLE_SIZE = 10;

    private final SegmentRepository segmentRepository;
    private final SegmentRuleRepository segmentRuleRepository;
    private final AudienceResolver audienceResolver;
    private final SegmentQueryBuilder queryBuilder;
    private final ObjectMapper objectMapper;
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ContactRepository contactRepository;

    @Transactional(readOnly = true)
    public PageResponse<SegmentView> list(UUID organizationId, PageQuery pageQuery, String q) {
        Page<Segment> page = segmentRepository.search(
                organizationId,
                trimToNull(q),
                pageQuery.toPageRequest(Sort.by(Sort.Direction.DESC, "createdAt")));
        List<SegmentView> items = page.getContent().stream()
                .map(segment -> toView(segment, audienceResolver.count(organizationId, segment.getId())))
                .toList();
        return PageResponse.of(items, page.getNumber(), page.getSize(), page.getTotalElements());
    }

    @Transactional(readOnly = true)
    public SegmentView get(UUID organizationId, UUID id) {
        Segment segment = requireSegment(organizationId, id);
        return toView(segment, audienceResolver.count(organizationId, id));
    }

    @Transactional
    public SegmentView create(UUID organizationId, UpsertSegmentRequest request) {
        Segment segment = new Segment();
        segment.setOrganizationId(organizationId);
        apply(segment, request, true);
        segment.setCreatedBy(SecurityUtils.currentUserIdOrNull());
        Segment saved = segmentRepository.save(segment);
        replaceRules(saved.getId(), request.rules());
        return toView(saved, audienceResolver.count(organizationId, saved.getId()));
    }

    @Transactional
    public SegmentView update(UUID organizationId, UUID id, UpsertSegmentRequest request) {
        Segment segment = requireSegment(organizationId, id);
        apply(segment, request, false);
        Segment saved = segmentRepository.save(segment);
        if (request.rules() != null) {
            replaceRules(saved.getId(), request.rules());
        }
        return toView(saved, audienceResolver.count(organizationId, saved.getId()));
    }

    @Transactional
    public void delete(UUID organizationId, UUID id) {
        Segment segment = requireSegment(organizationId, id);
        segment.setDeletedAt(java.time.Instant.now());
        segmentRepository.save(segment);
    }

    @Transactional(readOnly = true)
    public PreviewResult preview(UUID organizationId, PreviewRequest request) {
        JsonNode rules = toJson(request == null ? null : request.rules());
        String matchType = normalizeMatchType(request == null ? null : request.matchType());
        SegmentQueryBuilder.Compiled compiled = queryBuilder.compile(organizationId, rules, matchType);

        String where = "c.organization_id = :orgId and c.deleted_at is null and c.status = 'ACTIVE' and ("
                + compiled.predicate() + ")";
        Long count = jdbcTemplate.queryForObject(
                "select count(*) from contacts c where " + where, compiled.parameters(), Long.class);

        Map<String, Object> parameters = new LinkedHashMap<>(compiled.parameters());
        parameters.put("limit", PREVIEW_SAMPLE_SIZE);
        List<UUID> ids = jdbcTemplate.queryForList(
                "select c.id from contacts c where " + where
                        + " order by c.created_at asc limit :limit",
                parameters, UUID.class);

        List<ContactView> sample = loadContactsInOrder(organizationId, ids).stream()
                .map(this::toContactView)
                .toList();
        return new PreviewResult(count == null ? 0 : count, sample);
    }

    @Transactional(readOnly = true)
    public PageResponse<ContactView> members(UUID organizationId, UUID segmentId, PageQuery pageQuery) {
        requireSegment(organizationId, segmentId);
        long total = audienceResolver.count(organizationId, segmentId);
        List<UUID> ids = audienceResolver.resolveContactIds(
                organizationId, segmentId, pageQuery.size(), pageQuery.page() * pageQuery.size());
        List<ContactView> items = loadContactsInOrder(organizationId, ids).stream()
                .map(this::toContactView)
                .toList();
        return PageResponse.of(items, pageQuery.page(), pageQuery.size(), total);
    }

    @Transactional
    public int addMembers(UUID organizationId, UUID segmentId, List<UUID> contactIds) {
        requireSegment(organizationId, segmentId);
        if (contactIds == null || contactIds.isEmpty()) {
            throw new BadRequestException("CONTACT_IDS_REQUIRED", "contactIds is required");
        }
        List<UUID> requested = contactIds.stream().filter(Objects::nonNull).distinct().toList();
        if (requested.isEmpty()) {
            throw new BadRequestException("CONTACT_IDS_REQUIRED", "contactIds is required");
        }
        List<UUID> valid = contactRepository
                .findByIdInAndOrganizationIdAndDeletedAtIsNull(requested, organizationId).stream()
                .map(Contact::getId)
                .toList();
        int added = 0;
        for (UUID contactId : valid) {
            added += jdbcTemplate.update("""
                    insert into segment_members (segment_id, contact_id)
                    values (:segmentId, :contactId)
                    on conflict do nothing
                    """, Map.of("segmentId", segmentId, "contactId", contactId));
        }
        return added;
    }

    private void apply(Segment segment, UpsertSegmentRequest request, boolean creating) {
        if (creating || request.name() != null) {
            String name = trimToNull(request.name());
            if (name == null) {
                throw new BadRequestException("SEGMENT_NAME_REQUIRED", "Segment name is required");
            }
            segment.setName(name);
        }
        if (request.description() != null) {
            segment.setDescription(trimToNull(request.description()));
        }
        if (request.type() != null) {
            segment.setType(request.type());
        } else if (creating) {
            segment.setType(SegmentType.DYNAMIC);
        }
        if (request.matchType() != null) {
            segment.setMatchType(normalizeMatchType(request.matchType()));
        } else if (creating) {
            segment.setMatchType("ALL");
        }
        if (request.rules() != null || creating) {
            segment.setRules(toJson(request.rules()));
        }
        // Validates the field/operator whitelist and scalar/array requirements.
        queryBuilder.compile(segment.getOrganizationId(), segment.getRules(), segment.getMatchType());
    }

    private void replaceRules(UUID segmentId, List<SegmentRuleDto> rules) {
        segmentRuleRepository.deleteBySegmentId(segmentId);
        if (rules == null) {
            return;
        }
        int sortOrder = 0;
        for (SegmentRuleDto dto : rules) {
            if (dto == null) {
                continue;
            }
            SegmentRule rule = new SegmentRule();
            rule.setSegmentId(segmentId);
            rule.setField(dto.field());
            rule.setOperator(dto.operator());
            rule.setRuleValue(dto.value());
            rule.setLogicGroup(normalizeLogicGroup(dto.logicGroup()));
            rule.setSortOrder(sortOrder++);
            segmentRuleRepository.save(rule);
        }
    }

    private List<Contact> loadContactsInOrder(UUID organizationId, List<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        Map<UUID, Contact> byId = contactRepository
                .findByIdInAndOrganizationIdAndDeletedAtIsNull(ids, organizationId).stream()
                .collect(Collectors.toMap(Contact::getId, Function.identity()));
        List<Contact> ordered = new ArrayList<>();
        for (UUID id : ids) {
            Contact contact = byId.get(id);
            if (contact != null) {
                ordered.add(contact);
            }
        }
        return ordered;
    }

    private Segment requireSegment(UUID organizationId, UUID id) {
        return segmentRepository.findByIdAndOrganizationIdAndDeletedAtIsNull(id, organizationId)
                .orElseThrow(() -> new NotFoundException("Segment", id));
    }

    private JsonNode toJson(List<SegmentRuleDto> rules) {
        return objectMapper.valueToTree(rules == null ? List.of() : rules);
    }

    private String normalizeMatchType(String matchType) {
        String normalized = matchType == null || matchType.isBlank()
                ? "ALL"
                : matchType.trim().toUpperCase(Locale.ROOT);
        if (!"ALL".equals(normalized) && !"ANY".equals(normalized)) {
            throw new BadRequestException("INVALID_MATCH_TYPE", "matchType must be ALL or ANY");
        }
        return normalized;
    }

    private String normalizeLogicGroup(String logicGroup) {
        if (logicGroup == null || logicGroup.isBlank()) {
            return "AND";
        }
        String normalized = logicGroup.trim().toUpperCase(Locale.ROOT);
        if (!"AND".equals(normalized) && !"OR".equals(normalized)) {
            throw new BadRequestException("INVALID_LOGIC_GROUP", "logicGroup must be AND or OR");
        }
        return normalized;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private SegmentView toView(Segment segment, long contactCount) {
        return new SegmentView(
                segment.getId(),
                segment.getName(),
                segment.getDescription(),
                segment.getType(),
                segment.getMatchType(),
                segment.getRules(),
                contactCount,
                segment.getCreatedAt(),
                segment.getUpdatedAt());
    }

    private ContactView toContactView(Contact contact) {
        return new ContactView(
                contact.getId(),
                contact.getEmail(),
                contact.getPhone(),
                contact.getFirstName(),
                contact.getLastName(),
                contact.getStatus(),
                contact.getSource(),
                contact.getAttributes() == null ? Map.of() : contact.getAttributes(),
                List.of(),
                contact.getLastEngagementAt(),
                contact.getCreatedAt(),
                contact.getUpdatedAt(),
                List.of());
    }
}
