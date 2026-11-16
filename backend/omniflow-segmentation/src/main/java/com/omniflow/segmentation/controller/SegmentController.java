package com.omniflow.segmentation.controller;

import com.omniflow.common.api.ApiResponse;
import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.tenant.TenantGuard;
import com.omniflow.crm.dto.ContactView;
import com.omniflow.segmentation.dto.MembersRequest;
import com.omniflow.segmentation.dto.PreviewRequest;
import com.omniflow.segmentation.dto.PreviewResult;
import com.omniflow.segmentation.dto.SegmentView;
import com.omniflow.segmentation.dto.UpsertSegmentRequest;
import com.omniflow.segmentation.service.SegmentService;
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

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/segments")
@RequiredArgsConstructor
public class SegmentController {

    private final SegmentService segmentService;
    private final TenantGuard tenantGuard;

    @GetMapping
    public ApiResponse<PageResponse<SegmentView>> list(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String q) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(segmentService.list(organizationId, PageQuery.of(page, size), q));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<SegmentView> create(@Valid @RequestBody UpsertSegmentRequest request) {
        return ApiResponse.ok(segmentService.create(tenantGuard.currentOrganizationId(), request));
    }

    @GetMapping("/{id}")
    public ApiResponse<SegmentView> get(@PathVariable UUID id) {
        return ApiResponse.ok(segmentService.get(tenantGuard.currentOrganizationId(), id));
    }

    @PatchMapping("/{id}")
    public ApiResponse<SegmentView> update(@PathVariable UUID id,
                                           @Valid @RequestBody UpsertSegmentRequest request) {
        return ApiResponse.ok(segmentService.update(tenantGuard.currentOrganizationId(), id, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        segmentService.delete(tenantGuard.currentOrganizationId(), id);
    }

    @PostMapping("/preview")
    public ApiResponse<PreviewResult> preview(@RequestBody PreviewRequest request) {
        return ApiResponse.ok(segmentService.preview(tenantGuard.currentOrganizationId(), request));
    }

    @GetMapping("/{id}/members")
    public ApiResponse<PageResponse<ContactView>> members(
            @PathVariable UUID id,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(segmentService.members(organizationId, id, PageQuery.of(page, size)));
    }

    @PostMapping("/{id}/members")
    public ApiResponse<Map<String, Object>> addMembers(@PathVariable UUID id,
                                                       @RequestBody MembersRequest request) {
        int added = segmentService.addMembers(
                tenantGuard.currentOrganizationId(), id,
                request == null ? null : request.contactIds());
        return ApiResponse.ok(Map.of("added", added));
    }
}
