package com.omniflow.analytics.web;

import com.omniflow.analytics.dto.CampaignBreakdown;
import com.omniflow.analytics.dto.ChannelBreakdown;
import com.omniflow.analytics.dto.OverviewResponse;
import com.omniflow.analytics.dto.TimeSeriesPoint;
import com.omniflow.analytics.service.AnalyticsService;
import com.omniflow.common.api.ApiResponse;
import com.omniflow.common.tenant.TenantGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final TenantGuard tenantGuard;

    @GetMapping("/overview")
    public ApiResponse<OverviewResponse> overview(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(analyticsService.overview(organizationId, from, to));
    }

    @GetMapping("/timeseries")
    public ApiResponse<List<TimeSeriesPoint>> timeseries(
            @RequestParam(required = false) String metric,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(analyticsService.timeseries(organizationId, metric, from, to));
    }

    @GetMapping("/campaigns")
    public ApiResponse<List<CampaignBreakdown>> campaigns(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(analyticsService.campaigns(organizationId, from, to));
    }

    @GetMapping("/channels")
    public ApiResponse<List<ChannelBreakdown>> channels(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(analyticsService.channels(organizationId, from, to));
    }
}
