package com.omniflow.campaign.controller;

import com.omniflow.campaign.dto.CampaignStats;
import com.omniflow.campaign.dto.CampaignView;
import com.omniflow.campaign.dto.RecipientView;
import com.omniflow.campaign.dto.ScheduleRequest;
import com.omniflow.campaign.dto.UpsertCampaignRequest;
import com.omniflow.campaign.service.CampaignService;
import com.omniflow.common.api.ApiResponse;
import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.domain.enums.CampaignStatus;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.RecipientStatus;
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
@RequestMapping("/api/v1/campaigns")
@RequiredArgsConstructor
public class CampaignController {

    private final CampaignService campaignService;
    private final TenantGuard tenantGuard;

    @GetMapping
    public ApiResponse<PageResponse<CampaignView>> list(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) CampaignStatus status,
            @RequestParam(required = false) Channel channel,
            @RequestParam(required = false) String q) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(campaignService.list(organizationId, PageQuery.of(page, size), status, channel, q));
    }

    @PostMapping
    public ApiResponse<CampaignView> create(@Valid @RequestBody UpsertCampaignRequest request) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(campaignService.create(organizationId, request, tenantGuard.currentUserIdOrNull()));
    }

    @GetMapping("/{id}")
    public ApiResponse<CampaignView> get(@PathVariable UUID id) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(campaignService.get(organizationId, id));
    }

    @PatchMapping("/{id}")
    public ApiResponse<CampaignView> update(@PathVariable UUID id,
                                            @Valid @RequestBody UpsertCampaignRequest request) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(campaignService.update(organizationId, id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        campaignService.delete(organizationId, id);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/launch")
    public ApiResponse<CampaignView> launch(@PathVariable UUID id) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(campaignService.launch(organizationId, id));
    }

    @PostMapping("/{id}/schedule")
    public ApiResponse<CampaignView> schedule(@PathVariable UUID id,
                                              @Valid @RequestBody ScheduleRequest request) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(campaignService.schedule(organizationId, id, request.scheduledAt()));
    }

    @PostMapping("/{id}/pause")
    public ApiResponse<CampaignView> pause(@PathVariable UUID id) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(campaignService.pause(organizationId, id));
    }

    @PostMapping("/{id}/cancel")
    public ApiResponse<CampaignView> cancel(@PathVariable UUID id) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(campaignService.cancel(organizationId, id));
    }

    @GetMapping("/{id}/stats")
    public ApiResponse<CampaignStats> stats(@PathVariable UUID id) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(campaignService.stats(organizationId, id));
    }

    @GetMapping("/{id}/recipients")
    public ApiResponse<PageResponse<RecipientView>> recipients(
            @PathVariable UUID id,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) RecipientStatus status) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(campaignService.recipients(organizationId, id, PageQuery.of(page, size), status));
    }
}
