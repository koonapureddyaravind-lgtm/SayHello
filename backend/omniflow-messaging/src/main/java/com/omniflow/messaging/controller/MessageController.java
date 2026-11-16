package com.omniflow.messaging.controller;

import com.omniflow.common.api.ApiResponse;
import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.MessageStatus;
import com.omniflow.common.tenant.TenantGuard;
import com.omniflow.messaging.dto.MessageEventView;
import com.omniflow.messaging.dto.MessageView;
import com.omniflow.messaging.service.MessageQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageQueryService messageQueryService;
    private final TenantGuard tenantGuard;

    @GetMapping
    public ApiResponse<PageResponse<MessageView>> list(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Channel channel,
            @RequestParam(required = false) MessageStatus status,
            @RequestParam(required = false) UUID campaignId,
            @RequestParam(required = false) UUID contactId) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(messageQueryService.list(
                organizationId, PageQuery.of(page, size), channel, status, campaignId, contactId));
    }

    @GetMapping("/{id}")
    public ApiResponse<MessageView> get(@PathVariable UUID id) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(messageQueryService.get(organizationId, id));
    }

    @GetMapping("/{id}/events")
    public ApiResponse<List<MessageEventView>> events(@PathVariable UUID id) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(messageQueryService.events(organizationId, id));
    }

    @PostMapping("/{id}/retry")
    public ApiResponse<MessageView> retry(@PathVariable UUID id) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(messageQueryService.retry(organizationId, id));
    }
}
