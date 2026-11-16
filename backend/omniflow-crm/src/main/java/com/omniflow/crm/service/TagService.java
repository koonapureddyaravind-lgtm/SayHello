package com.omniflow.crm.service;

import com.omniflow.common.exception.ConflictException;
import com.omniflow.common.exception.NotFoundException;
import com.omniflow.crm.domain.Tag;
import com.omniflow.crm.dto.CreateTagRequest;
import com.omniflow.crm.dto.TagView;
import com.omniflow.crm.repository.TagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TagService {

    private static final String DEFAULT_COLOR = "#64748b";

    private final TagRepository tagRepository;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public List<TagView> list(UUID organizationId) {
        String sql = """
                select t.id, t.name, t.color, count(ct.contact_id) as contact_count
                from tags t
                left join contact_tags ct on ct.tag_id = t.id
                where t.organization_id = :orgId
                group by t.id, t.name, t.color
                order by lower(t.name)
                """;
        return jdbcTemplate.query(sql, Map.of("orgId", organizationId),
                (rs, rowNum) -> new TagView(
                        rs.getObject("id", UUID.class),
                        rs.getString("name"),
                        rs.getString("color"),
                        rs.getLong("contact_count")));
    }

    @Transactional
    public TagView create(UUID organizationId, CreateTagRequest request) {
        String name = request.name() == null ? "" : request.name().trim();
        if (name.isEmpty()) {
            throw new com.omniflow.common.exception.BadRequestException("TAG_NAME_REQUIRED", "Tag name is required");
        }
        if (tagRepository.existsByOrganizationIdAndNameIgnoreCase(organizationId, name)) {
            throw new ConflictException("TAG_EXISTS", "A tag with this name already exists");
        }
        Tag tag = new Tag();
        tag.setOrganizationId(organizationId);
        tag.setName(name);
        tag.setColor(normalizeColor(request.color()));
        Tag saved = tagRepository.save(tag);
        return new TagView(saved.getId(), saved.getName(), saved.getColor(), 0);
    }

    @Transactional
    public TagView update(UUID organizationId, UUID id, CreateTagRequest request) {
        Tag tag = requireTag(organizationId, id);
        if (request.name() != null) {
            String name = request.name().trim();
            if (name.isEmpty()) {
                throw new com.omniflow.common.exception.BadRequestException("TAG_NAME_REQUIRED", "Tag name is required");
            }
            tagRepository.findByOrganizationIdAndNameIgnoreCase(organizationId, name)
                    .filter(existing -> !existing.getId().equals(id))
                    .ifPresent(existing -> {
                        throw new ConflictException("TAG_EXISTS", "A tag with this name already exists");
                    });
            tag.setName(name);
        }
        if (request.color() != null) {
            tag.setColor(normalizeColor(request.color()));
        }
        Tag saved = tagRepository.save(tag);
        return new TagView(saved.getId(), saved.getName(), saved.getColor(), countContacts(saved.getId()));
    }

    @Transactional
    public void delete(UUID organizationId, UUID id) {
        Tag tag = requireTag(organizationId, id);
        tagRepository.delete(tag);
    }

    @Transactional
    public Tag findOrCreate(UUID organizationId, String rawName) {
        String name = rawName == null ? "" : rawName.trim();
        if (name.isEmpty()) {
            throw new com.omniflow.common.exception.BadRequestException("TAG_NAME_REQUIRED", "Tag name is required");
        }
        return tagRepository.findByOrganizationIdAndNameIgnoreCase(organizationId, name)
                .orElseGet(() -> {
                    Tag tag = new Tag();
                    tag.setOrganizationId(organizationId);
                    tag.setName(name);
                    tag.setColor(DEFAULT_COLOR);
                    return tagRepository.saveAndFlush(tag);
                });
    }

    @Transactional(readOnly = true)
    public Tag requireTag(UUID organizationId, UUID id) {
        return tagRepository.findByIdAndOrganizationId(id, organizationId)
                .orElseThrow(() -> new NotFoundException("Tag", id));
    }

    private long countContacts(UUID tagId) {
        Long count = jdbcTemplate.queryForObject(
                "select count(*) from contact_tags where tag_id = :tagId",
                Map.of("tagId", tagId), Long.class);
        return count == null ? 0 : count;
    }

    private String normalizeColor(String color) {
        if (color == null || color.isBlank()) {
            return DEFAULT_COLOR;
        }
        return color.trim();
    }
}
