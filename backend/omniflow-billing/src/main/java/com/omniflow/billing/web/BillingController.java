package com.omniflow.billing.web;

import com.omniflow.billing.dto.ChangePlanRequest;
import com.omniflow.billing.dto.InvoiceView;
import com.omniflow.billing.dto.PlanView;
import com.omniflow.billing.dto.SubscriptionView;
import com.omniflow.billing.dto.UsageSummary;
import com.omniflow.billing.service.BillingService;
import com.omniflow.common.api.ApiResponse;
import com.omniflow.common.tenant.TenantGuard;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/billing")
@RequiredArgsConstructor
public class BillingController {

    private final BillingService billingService;
    private final TenantGuard tenantGuard;

    @GetMapping("/plans")
    public ApiResponse<List<PlanView>> plans() {
        return ApiResponse.ok(billingService.plans());
    }

    @GetMapping("/subscription")
    public ApiResponse<SubscriptionView> subscription() {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(billingService.subscription(organizationId));
    }

    @PostMapping("/subscription")
    public ApiResponse<SubscriptionView> changePlan(@Valid @RequestBody ChangePlanRequest request) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(billingService.changePlan(organizationId, request.planCode()));
    }

    @GetMapping("/usage")
    public ApiResponse<UsageSummary> usage(@RequestParam(required = false) String period) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(billingService.usage(organizationId, period));
    }

    @GetMapping("/invoices")
    public ApiResponse<List<InvoiceView>> invoices() {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(billingService.invoices(organizationId));
    }
}
