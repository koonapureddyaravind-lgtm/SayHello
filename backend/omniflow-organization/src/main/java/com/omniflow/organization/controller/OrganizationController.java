package com.omniflow.organization.controller;

import com.omniflow.common.api.ApiResponse;
import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.tenant.TenantGuard;
import com.omniflow.organization.dto.AddMemberRequest;
import com.omniflow.organization.dto.CreateOrganizationRequest;
import com.omniflow.organization.dto.MemberView;
import com.omniflow.organization.dto.OrganizationView;
import com.omniflow.organization.dto.UpdateMemberRequest;
import com.omniflow.organization.dto.UpdateOrganizationRequest;
import com.omniflow.organization.dto.WorkspaceView;
import com.omniflow.organization.service.OrganizationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/organizations")
public class OrganizationController {

    private final OrganizationService organizationService;
    private final TenantGuard tenantGuard;

    public OrganizationController(OrganizationService organizationService, TenantGuard tenantGuard) {
        this.organizationService = organizationService;
        this.tenantGuard = tenantGuard;
    }

    @GetMapping({"", "/"})
    public ResponseEntity<ApiResponse<List<OrganizationView>>> listMine() {
        return ResponseEntity.ok(ApiResponse.ok(organizationService.listMine()));
    }

    @PostMapping({"", "/"})
    public ResponseEntity<ApiResponse<OrganizationView>> create(
            @Valid @RequestBody CreateOrganizationRequest request) {
        OrganizationView view = organizationService.create(
                request.name(), request.slug(), request.type());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(view));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OrganizationView>> get(@PathVariable UUID id) {
        tenantGuard.requireOrganization(id);
        return ResponseEntity.ok(ApiResponse.ok(organizationService.get(id)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<OrganizationView>> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateOrganizationRequest request) {
        tenantGuard.requireOrganization(id);
        OrganizationView view = organizationService.update(
                id, request.name(), request.timezone(), request.settings());
        return ResponseEntity.ok(ApiResponse.ok(view));
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<ApiResponse<PageResponse<MemberView>>> listMembers(
            @PathVariable UUID id,
            @RequestParam(name = "page", required = false) Integer page,
            @RequestParam(name = "size", required = false) Integer size) {
        tenantGuard.requireOrganization(id);
        PageResponse<MemberView> members =
                organizationService.listMembers(id, PageQuery.of(page, size));
        return ResponseEntity.ok(ApiResponse.ok(members));
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<ApiResponse<MemberView>> addMember(
            @PathVariable UUID id,
            @Valid @RequestBody AddMemberRequest request) {
        tenantGuard.requireOrganization(id);
        MemberView member = organizationService.addMember(id, request.email(), request.role());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(member));
    }

    @PatchMapping("/{id}/members/{membershipId}")
    public ResponseEntity<ApiResponse<MemberView>> updateMember(
            @PathVariable UUID id,
            @PathVariable UUID membershipId,
            @Valid @RequestBody UpdateMemberRequest request) {
        tenantGuard.requireOrganization(id);
        MemberView member = organizationService.updateMemberRole(
                id, membershipId, request.role(), request.status());
        return ResponseEntity.ok(ApiResponse.ok(member));
    }

    @DeleteMapping("/{id}/members/{membershipId}")
    public ResponseEntity<ApiResponse<Void>> removeMember(
            @PathVariable UUID id,
            @PathVariable UUID membershipId) {
        tenantGuard.requireOrganization(id);
        organizationService.removeMember(id, membershipId);
        return ResponseEntity.ok(ApiResponse.ok());
    }

    @GetMapping("/{id}/workspaces")
    public ResponseEntity<ApiResponse<List<WorkspaceView>>> listWorkspaces(@PathVariable UUID id) {
        tenantGuard.requireOrganization(id);
        return ResponseEntity.ok(ApiResponse.ok(organizationService.listWorkspaces(id)));
    }

    @PostMapping("/{id}/workspaces")
    public ResponseEntity<ApiResponse<WorkspaceView>> createWorkspace(
            @PathVariable UUID id,
            @Valid @RequestBody CreateOrganizationRequest request) {
        tenantGuard.requireOrganization(id);
        WorkspaceView workspace = organizationService.createWorkspace(
                id, request.name(), request.slug(), request.type());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(workspace));
    }
}
