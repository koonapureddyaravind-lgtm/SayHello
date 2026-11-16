package com.omniflow.template.port;

import com.omniflow.common.port.RenderedTemplate;
import com.omniflow.common.port.TemplatePort;
import com.omniflow.template.service.TemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TemplatePortImpl implements TemplatePort {

    private final TemplateService templateService;

    @Override
    public Optional<RenderedTemplate> render(UUID organizationId, UUID templateId, Map<String, Object> variables) {
        return templateService.render(organizationId, templateId, variables);
    }
}
