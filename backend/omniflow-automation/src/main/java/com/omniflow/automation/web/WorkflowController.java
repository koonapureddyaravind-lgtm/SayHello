package com.omniflow.automation.web;

import com.omniflow.automation.dto.ExecutionView;
import com.omniflow.automation.dto.PublishWorkflowRequest;
import com.omniflow.automation.dto.TestWorkflowRequest;
import com.omniflow.automation.dto.UpsertWorkflowRequest;
import com.omniflow.automation.dto.WorkflowView;
import com.omniflow.automation.service.WorkflowService;
import com.omniflow.common.api.ApiResponse;
import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.domain.enums.WorkflowStatus;
import com.omniflow.common.tenant.TenantGuard;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/workflows")
@RequiredArgsConstructor
public class WorkflowController {

    private final WorkflowService workflowService;
    private final TenantGuard tenantGuard;

    @GetMapping
    public ApiResponse<PageResponse<WorkflowView>> list(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) WorkflowStatus status,
            @RequestParam(required = false) String q) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(workflowService.list(organizationId, PageQuery.of(page, size), status, q));
    }

    @PostMapping
    public ApiResponse<WorkflowView> create(@Valid @RequestBody UpsertWorkflowRequest request) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(workflowService.create(organizationId, tenantGuard.currentUserIdOrNull(), request));
    }

    @GetMapping("/{id}")
    public ApiResponse<WorkflowView> get(@PathVariable UUID id) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(workflowService.get(organizationId, id));
    }

    @PatchMapping("/{id}")
    public ApiResponse<WorkflowView> update(@PathVariable UUID id,
                                            @Valid @RequestBody UpsertWorkflowRequest request) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(workflowService.update(organizationId, id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        workflowService.delete(organizationId, id);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/publish")
    public ApiResponse<WorkflowView> publish(@PathVariable UUID id,
                                             @Valid @RequestBody PublishWorkflowRequest request) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(workflowService.publish(
                organizationId, tenantGuard.currentUserIdOrNull(), id, request.graph()));
    }

    @PostMapping("/{id}/activate")
    public ApiResponse<WorkflowView> activate(@PathVariable UUID id) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(workflowService.activate(organizationId, id));
    }

    @PostMapping("/{id}/pause")
    public ApiResponse<WorkflowView> pause(@PathVariable UUID id) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(workflowService.pause(organizationId, id));
    }

    @GetMapping("/{id}/executions")
    public ApiResponse<PageResponse<ExecutionView>> executions(
            @PathVariable UUID id,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(workflowService.executions(organizationId, id, PageQuery.of(page, size)));
    }

    @PostMapping("/{id}/test")
    public ApiResponse<ExecutionView> test(@PathVariable UUID id,
                                           @Valid @RequestBody TestWorkflowRequest request) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(workflowService.test(organizationId, id, request.contactId()));
    }
}
