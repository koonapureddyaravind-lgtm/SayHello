package com.omniflow.crm.controller;

import com.omniflow.common.api.ApiResponse;
import com.omniflow.common.tenant.TenantGuard;
import com.omniflow.crm.dto.CreateTagRequest;
import com.omniflow.crm.dto.TagView;
import com.omniflow.crm.service.TagService;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping({"/api/v1/tags", "/api/v1/contacts/tags"})
@RequiredArgsConstructor
public class TagController {

    private final TagService tagService;
    private final TenantGuard tenantGuard;

    @GetMapping
    public ApiResponse<List<TagView>> list() {
        return ApiResponse.ok(tagService.list(tenantGuard.currentOrganizationId()));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<TagView> create(@Valid @RequestBody CreateTagRequest request) {
        return ApiResponse.ok(tagService.create(tenantGuard.currentOrganizationId(), request));
    }

    @PatchMapping("/{id}")
    public ApiResponse<TagView> update(@PathVariable UUID id,
                                       @Valid @RequestBody CreateTagRequest request) {
        return ApiResponse.ok(tagService.update(tenantGuard.currentOrganizationId(), id, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        tagService.delete(tenantGuard.currentOrganizationId(), id);
    }
}
