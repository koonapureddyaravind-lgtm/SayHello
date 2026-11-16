package com.omniflow.audit.controller;

import com.omniflow.audit.dto.AuditLogView;
import com.omniflow.audit.entity.AuditLog;
import com.omniflow.audit.repository.AuditLogRepository;
import com.omniflow.common.api.ApiResponse;
import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.exception.BadRequestException;
import com.omniflow.common.tenant.TenantGuard;
import com.omniflow.common.util.PageMapper;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/audit-logs")
public class AuditLogController {

    private final AuditLogRepository auditLogRepository;
    private final TenantGuard tenantGuard;

    public AuditLogController(AuditLogRepository auditLogRepository, TenantGuard tenantGuard) {
        this.auditLogRepository = auditLogRepository;
        this.tenantGuard = tenantGuard;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<AuditLogView>>> list(
            @RequestParam(name = "page", required = false) Integer page,
            @RequestParam(name = "size", required = false) Integer size,
            @RequestParam(name = "action", required = false) String action,
            @RequestParam(name = "entityType", required = false) String entityType,
            @RequestParam(name = "from", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(name = "to", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {

        UUID organizationId = tenantGuard.currentOrganizationId();
        Instant start = from == null ? Instant.EPOCH : from;
        Instant end = to == null ? Instant.now() : to;
        if (start.isAfter(end)) {
            throw new BadRequestException("INVALID_TIME_RANGE", "The 'from' value must be before 'to'");
        }

        PageQuery pageQuery = PageQuery.of(page, size);
        PageResponse<AuditLogView> response = PageMapper.of(
                auditLogRepository.search(
                        organizationId,
                        start,
                        end,
                        blankToNull(action),
                        blankToNull(entityType),
                        pageQuery.toPageRequest(Sort.by(Sort.Direction.DESC, "createdAt"))),
                this::toView);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    private AuditLogView toView(AuditLog log) {
        return new AuditLogView(
                log.getId(),
                log.getOrganizationId(),
                log.getActorUserId(),
                log.getAction(),
                log.getEntityType(),
                log.getEntityId(),
                log.getBeforeState(),
                log.getAfterState(),
                log.getIpAddress(),
                log.getUserAgent(),
                log.getCreatedAt());
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
