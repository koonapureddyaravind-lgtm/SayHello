package com.omniflow.template.controller;

import com.omniflow.common.api.ApiResponse;
import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.TemplateStatus;
import com.omniflow.common.tenant.TenantGuard;
import com.omniflow.template.dto.PreviewRequest;
import com.omniflow.template.dto.PreviewResponse;
import com.omniflow.template.dto.TemplateView;
import com.omniflow.template.dto.UpsertTemplateRequest;
import com.omniflow.template.dto.VersionView;
import com.omniflow.template.service.TemplateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/templates")
@RequiredArgsConstructor
public class TemplateController {

    private final TemplateService templateService;
    private final TenantGuard tenantGuard;

    @GetMapping
    public ApiResponse<PageResponse<TemplateView>> list(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Channel channel,
            @RequestParam(required = false) TemplateStatus status) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(templateService.list(
                organizationId, PageQuery.of(page, size), q, channel, status));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<TemplateView> create(@Valid @RequestBody UpsertTemplateRequest request) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(templateService.create(
                organizationId, tenantGuard.currentUserIdOrNull(), request));
    }

    @GetMapping("/{id}")
    public ApiResponse<TemplateView> get(@PathVariable UUID id) {
        return ApiResponse.ok(templateService.get(tenantGuard.currentOrganizationId(), id));
    }

    @PatchMapping("/{id}")
    public ApiResponse<TemplateView> update(@PathVariable UUID id,
                                            @Valid @RequestBody UpsertTemplateRequest request) {
        return ApiResponse.ok(templateService.update(tenantGuard.currentOrganizationId(), id, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        templateService.delete(tenantGuard.currentOrganizationId(), id);
    }

    @PostMapping("/{id}/publish")
    public ApiResponse<TemplateView> publish(@PathVariable UUID id) {
        return ApiResponse.ok(templateService.publish(tenantGuard.currentOrganizationId(), id));
    }

    @GetMapping("/{id}/versions")
    public ApiResponse<List<VersionView>> versions(@PathVariable UUID id) {
        return ApiResponse.ok(templateService.versions(tenantGuard.currentOrganizationId(), id));
    }

    @PostMapping("/{id}/preview")
    public ApiResponse<PreviewResponse> preview(@PathVariable UUID id,
                                                @RequestBody(required = false) PreviewRequest request) {
        return ApiResponse.ok(templateService.preview(
                tenantGuard.currentOrganizationId(),
                id,
                request == null ? null : request.variables()));
    }
}
