package com.omniflow.integration.controller;

import com.omniflow.common.api.ApiResponse;
import com.omniflow.common.exception.ForbiddenException;
import com.omniflow.common.port.MembershipChecker;
import com.omniflow.common.tenant.TenantGuard;
import com.omniflow.integration.dto.IntegrationTestResult;
import com.omniflow.integration.dto.IntegrationView;
import com.omniflow.integration.dto.UpsertIntegrationRequest;
import com.omniflow.integration.service.IntegrationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/integrations")
@RequiredArgsConstructor
public class IntegrationController {

    private static final Set<String> INTEGRATION_ADMIN_ROLES =
            Set.of("OWNER", "ADMIN", "AGENCY_OWNER", "PLATFORM_ADMIN");

    private final IntegrationService integrationService;
    private final TenantGuard tenantGuard;
    private final ObjectProvider<MembershipChecker> membershipChecker;

    @GetMapping
    public ApiResponse<List<IntegrationView>> list() {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(integrationService.list(organizationId));
    }

    @PostMapping
    public ApiResponse<IntegrationView> create(@Valid @RequestBody UpsertIntegrationRequest request) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        requireAdmin(organizationId);
        return ApiResponse.ok(integrationService.create(organizationId, request));
    }

    @PatchMapping("/{id}")
    public ApiResponse<IntegrationView> update(@PathVariable UUID id,
                                               @Valid @RequestBody UpsertIntegrationRequest request) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        requireAdmin(organizationId);
        return ApiResponse.ok(integrationService.update(organizationId, id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        requireAdmin(organizationId);
        integrationService.delete(organizationId, id);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/test")
    public ApiResponse<IntegrationTestResult> test(@PathVariable UUID id) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        requireAdmin(organizationId);
        return ApiResponse.ok(integrationService.test(organizationId, id));
    }

    private void requireAdmin(UUID organizationId) {
        // MembershipChecker is implemented in the organization module, which the worker
        // omits; this controller is still component-scanned there, so resolve it lazily.
        MembershipChecker checker = membershipChecker.getIfAvailable();
        if (checker == null) {
            return;
        }
        UUID userId = tenantGuard.currentUserId();
        String role = checker.roleCode(organizationId, userId)
                .orElseThrow(() -> new ForbiddenException("NOT_A_MEMBER",
                        "You are not a member of this organization"));
        if (!INTEGRATION_ADMIN_ROLES.contains(role)) {
            throw new ForbiddenException("INSUFFICIENT_ROLE",
                    "Only owners and admins can manage provider integrations");
        }
    }
}
