package com.omniflow.common.port;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public interface TemplatePort {

    Optional<RenderedTemplate> render(UUID organizationId, UUID templateId, Map<String, Object> variables);
}
