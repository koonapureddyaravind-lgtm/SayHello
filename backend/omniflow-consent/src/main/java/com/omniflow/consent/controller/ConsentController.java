package com.omniflow.consent.controller;

import com.omniflow.common.api.ApiResponse;
import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.tenant.TenantGuard;
import com.omniflow.consent.dto.ConsentView;
import com.omniflow.consent.dto.RecordConsentRequest;
import com.omniflow.consent.service.ConsentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/consent")
@RequiredArgsConstructor
public class ConsentController {

    private final ConsentService consentService;
    private final TenantGuard tenantGuard;

    @GetMapping
    public ApiResponse<PageResponse<ConsentView>> list(
            @RequestParam(required = false) UUID contactId,
            @RequestParam(required = false) Channel channel,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(consentService.list(organizationId, contactId, channel, PageQuery.of(page, size)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ConsentView> record(@Valid @RequestBody RecordConsentRequest request) {
        return ApiResponse.ok(consentService.record(tenantGuard.currentOrganizationId(), request));
    }
}
