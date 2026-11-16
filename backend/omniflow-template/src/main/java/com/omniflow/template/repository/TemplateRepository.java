package com.omniflow.template.repository;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.TemplateStatus;
import com.omniflow.template.domain.Template;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface TemplateRepository extends JpaRepository<Template, UUID> {

    @Query("""
            select t from Template t
            where t.organizationId = :orgId
              and t.deletedAt is null
              and lower(t.name) like lower(concat('%', coalesce(:q, ''), '%'))
              and (:channel is null or t.channel = :channel)
              and (:status is null or t.status = :status)
            """)
    Page<Template> search(@Param("orgId") UUID organizationId,
                          @Param("q") String q,
                          @Param("channel") Channel channel,
                          @Param("status") TemplateStatus status,
                          Pageable pageable);

    Optional<Template> findByIdAndOrganizationIdAndDeletedAtIsNull(UUID id, UUID organizationId);
}
