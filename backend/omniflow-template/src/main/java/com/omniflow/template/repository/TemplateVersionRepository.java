package com.omniflow.template.repository;

import com.omniflow.template.domain.TemplateVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TemplateVersionRepository extends JpaRepository<TemplateVersion, UUID> {

    List<TemplateVersion> findByTemplateIdOrderByVersionDesc(UUID templateId);

    Optional<TemplateVersion> findByTemplateIdAndVersion(UUID templateId, int version);
}
