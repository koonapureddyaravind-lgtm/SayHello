package com.omniflow.audit.service;

import com.omniflow.audit.entity.AuditLog;
import com.omniflow.audit.repository.AuditLogRepository;
import com.omniflow.common.port.AuditPort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class AuditPortImpl implements AuditPort {

    private final AuditLogRepository auditLogRepository;

    public AuditPortImpl(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Override
    @Transactional
    public void record(UUID organizationId,
                       UUID actorUserId,
                       String action,
                       String entityType,
                       String entityId,
                       Map<String, Object> before,
                       Map<String, Object> after) {
        AuditLog log = new AuditLog();
        log.setOrganizationId(organizationId);
        log.setActorUserId(actorUserId);
        log.setAction(action);
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setBeforeState(before);
        log.setAfterState(after);
        log.setCreatedAt(Instant.now());
        auditLogRepository.save(log);
    }
}
