package com.omniflow.template.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.TemplateStatus;
import com.omniflow.common.exception.BadRequestException;
import com.omniflow.common.exception.NotFoundException;
import com.omniflow.common.port.RenderedTemplate;
import com.omniflow.common.security.SecurityUtils;
import com.omniflow.common.util.PageMapper;
import com.omniflow.template.domain.Template;
import com.omniflow.template.domain.TemplateVersion;
import com.omniflow.template.dto.PreviewResponse;
import com.omniflow.template.dto.TemplateView;
import com.omniflow.template.dto.UpsertTemplateRequest;
import com.omniflow.template.dto.VersionView;
import com.omniflow.template.repository.TemplateRepository;
import com.omniflow.template.repository.TemplateVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class TemplateService {

    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{([^{}]+?)\\}\\}");

    private final TemplateRepository templateRepository;
    private final TemplateVersionRepository templateVersionRepository;

    @Transactional(readOnly = true)
    public PageResponse<TemplateView> list(UUID organizationId,
                                           PageQuery pageQuery,
                                           String q,
                                           Channel channel,
                                           TemplateStatus status) {
        Page<Template> page = templateRepository.search(
                organizationId,
                trimToNull(q),
                channel,
                status,
                pageQuery.toPageRequest(Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageMapper.of(page, this::toView);
    }

    @Transactional(readOnly = true)
    public TemplateView get(UUID organizationId, UUID id) {
        return toView(requireTemplate(organizationId, id));
    }

    @Transactional
    public TemplateView create(UUID organizationId, UUID actorId, UpsertTemplateRequest request) {
        String name = trimToNull(request.name());
        if (name == null) {
            throw new BadRequestException("TEMPLATE_NAME_REQUIRED", "Template name is required");
        }
        if (request.channel() == null) {
            throw new BadRequestException("TEMPLATE_CHANNEL_REQUIRED", "Template channel is required");
        }

        Template template = new Template();
        template.setOrganizationId(organizationId);
        template.setName(name);
        template.setChannel(request.channel());
        template.setSubject(request.subject() == null ? null : request.subject().trim());
        template.setBody(request.body() == null ? "" : request.body());
        template.setHtmlBody(request.htmlBody());
        template.setStatus(TemplateStatus.DRAFT);
        template.setCurrentVersion(1);
        template.setCreatedBy(actorId);
        template.setVariables(extractVariables(
                template.getSubject(), template.getBody(), template.getHtmlBody()));
        return toView(templateRepository.save(template));
    }

    @Transactional
    public TemplateView update(UUID organizationId, UUID id, UpsertTemplateRequest request) {
        Template template = requireTemplate(organizationId, id);

        if (request.name() != null) {
            String name = trimToNull(request.name());
            if (name == null) {
                throw new BadRequestException("TEMPLATE_NAME_REQUIRED", "Template name is required");
            }
            template.setName(name);
        }
        if (request.channel() != null) {
            template.setChannel(request.channel());
        }
        if (request.subject() != null) {
            template.setSubject(trimToNull(request.subject()));
        }
        if (request.body() != null) {
            template.setBody(request.body());
        }
        if (request.htmlBody() != null) {
            template.setHtmlBody(request.htmlBody());
        }
        template.setVariables(extractVariables(
                template.getSubject(), template.getBody(), template.getHtmlBody()));

        int nextVersion = template.getCurrentVersion() + 1;
        template.setCurrentVersion(nextVersion);
        Template saved = templateRepository.save(template);
        snapshot(saved, nextVersion, SecurityUtils.currentUserIdOrNull());
        return toView(saved);
    }

    @Transactional
    public TemplateView publish(UUID organizationId, UUID id) {
        Template template = requireTemplate(organizationId, id);
        template.setStatus(TemplateStatus.PUBLISHED);

        int nextVersion = template.getCurrentVersion() + 1;
        template.setCurrentVersion(nextVersion);
        Template saved = templateRepository.save(template);
        snapshot(saved, nextVersion, SecurityUtils.currentUserIdOrNull());
        return toView(saved);
    }

    @Transactional
    public void delete(UUID organizationId, UUID id) {
        Template template = requireTemplate(organizationId, id);
        template.setDeletedAt(Instant.now());
        templateRepository.save(template);
    }

    @Transactional(readOnly = true)
    public List<VersionView> versions(UUID organizationId, UUID id) {
        requireTemplate(organizationId, id);
        return templateVersionRepository.findByTemplateIdOrderByVersionDesc(id).stream()
                .map(this::toVersionView)
                .toList();
    }

    @Transactional(readOnly = true)
    public PreviewResponse preview(UUID organizationId, UUID id, Map<String, Object> variables) {
        RenderedTemplate rendered = render(organizationId, id, variables)
                .orElseThrow(() -> new NotFoundException("Template", id));
        return new PreviewResponse(rendered.subject(), rendered.body(), rendered.htmlBody());
    }

    @Transactional(readOnly = true)
    public Optional<RenderedTemplate> render(UUID organizationId, UUID templateId, Map<String, Object> variables) {
        return templateRepository.findByIdAndOrganizationIdAndDeletedAtIsNull(templateId, organizationId)
                .map(template -> new RenderedTemplate(
                        renderText(template.getSubject(), variables),
                        renderText(template.getBody(), variables),
                        renderText(template.getHtmlBody(), variables)));
    }

    private void snapshot(Template template, int version, UUID actorId) {
        TemplateVersion snapshot = new TemplateVersion();
        snapshot.setTemplateId(template.getId());
        snapshot.setVersion(version);
        snapshot.setSubject(template.getSubject());
        snapshot.setBody(template.getBody() == null ? "" : template.getBody());
        snapshot.setHtmlBody(template.getHtmlBody());
        snapshot.setVariables(template.getVariables() == null
                ? JsonNodeFactory.instance.arrayNode()
                : template.getVariables().deepCopy());
        snapshot.setCreatedBy(actorId);
        templateVersionRepository.save(snapshot);
    }

    private Template requireTemplate(UUID organizationId, UUID id) {
        return templateRepository.findByIdAndOrganizationIdAndDeletedAtIsNull(id, organizationId)
                .orElseThrow(() -> new NotFoundException("Template", id));
    }

    private JsonNode extractVariables(String... texts) {
        Set<String> names = new LinkedHashSet<>();
        for (String text : texts) {
            if (text == null) {
                continue;
            }
            Matcher matcher = VARIABLE_PATTERN.matcher(text);
            while (matcher.find()) {
                String name = matcher.group(1).trim();
                if (!name.isEmpty()) {
                    names.add(name);
                }
            }
        }
        ArrayNode array = JsonNodeFactory.instance.arrayNode();
        names.forEach(array::add);
        return array;
    }

    private String renderText(String template, Map<String, Object> variables) {
        if (template == null) {
            return null;
        }
        Matcher matcher = VARIABLE_PATTERN.matcher(template);
        StringBuilder builder = new StringBuilder();
        while (matcher.find()) {
            String key = matcher.group(1).trim();
            Object value = resolveValue(variables, key);
            matcher.appendReplacement(builder, Matcher.quoteReplacement(value == null ? "" : String.valueOf(value)));
        }
        matcher.appendTail(builder);
        return builder.toString();
    }

    private Object resolveValue(Map<String, Object> variables, String key) {
        if (variables == null) {
            return null;
        }
        if (variables.containsKey(key)) {
            return variables.get(key);
        }
        Object current = variables;
        for (String part : key.split("\\.")) {
            if (current instanceof Map<?, ?> map) {
                current = map.get(part);
            } else if (current instanceof List<?> list) {
                try {
                    int index = Integer.parseInt(part);
                    current = index >= 0 && index < list.size() ? list.get(index) : null;
                } catch (NumberFormatException ex) {
                    current = null;
                }
            } else {
                current = null;
            }
            if (current == null) {
                return null;
            }
        }
        return current;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private TemplateView toView(Template template) {
        return new TemplateView(
                template.getId(),
                template.getName(),
                template.getChannel(),
                template.getSubject(),
                template.getBody(),
                template.getHtmlBody(),
                template.getVariables(),
                template.getStatus(),
                template.getCurrentVersion(),
                template.getCreatedAt(),
                template.getUpdatedAt());
    }

    private VersionView toVersionView(TemplateVersion version) {
        return new VersionView(
                version.getId(),
                version.getVersion(),
                version.getSubject(),
                version.getBody(),
                version.getHtmlBody(),
                version.getVariables(),
                version.getCreatedBy(),
                version.getCreatedAt());
    }
}
