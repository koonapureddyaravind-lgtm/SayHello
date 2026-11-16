package com.omniflow.inbox.web;

import com.omniflow.common.api.ApiResponse;
import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.ConversationStatus;
import com.omniflow.common.tenant.TenantGuard;
import com.omniflow.inbox.dto.AssignRequest;
import com.omniflow.inbox.dto.ConversationMessageView;
import com.omniflow.inbox.dto.ConversationView;
import com.omniflow.inbox.dto.ReplyRequest;
import com.omniflow.inbox.dto.StatusRequest;
import com.omniflow.inbox.service.InboxService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final InboxService inboxService;
    private final TenantGuard tenantGuard;

    @GetMapping
    public ApiResponse<PageResponse<ConversationView>> list(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) ConversationStatus status,
            @RequestParam(required = false) Channel channel,
            @RequestParam(required = false) UUID assignee,
            @RequestParam(required = false) String q) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(inboxService.list(
                organizationId, PageQuery.of(page, size), status, channel, assignee, q));
    }

    @GetMapping("/{id}")
    public ApiResponse<ConversationView> get(@PathVariable UUID id) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(inboxService.get(organizationId, id));
    }

    @GetMapping("/{id}/messages")
    public ApiResponse<PageResponse<ConversationMessageView>> messages(
            @PathVariable UUID id,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(inboxService.messages(organizationId, id, PageQuery.of(page, size)));
    }

    @PostMapping("/{id}/messages")
    public ApiResponse<ConversationMessageView> reply(@PathVariable UUID id,
                                                      @Valid @RequestBody ReplyRequest request) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(inboxService.reply(
                organizationId, tenantGuard.currentUserIdOrNull(), id, request.body()));
    }

    @PostMapping("/{id}/assign")
    public ApiResponse<ConversationView> assign(@PathVariable UUID id,
                                                @Valid @RequestBody AssignRequest request) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(inboxService.assign(
                organizationId, id, request.userId(), tenantGuard.currentUserIdOrNull()));
    }

    @PostMapping("/{id}/status")
    public ApiResponse<ConversationView> status(@PathVariable UUID id,
                                                @Valid @RequestBody StatusRequest request) {
        UUID organizationId = tenantGuard.currentOrganizationId();
        return ApiResponse.ok(inboxService.updateStatus(organizationId, id, request.status()));
    }
}
