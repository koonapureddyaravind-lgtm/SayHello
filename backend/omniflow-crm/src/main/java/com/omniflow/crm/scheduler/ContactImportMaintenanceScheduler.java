package com.omniflow.crm.scheduler;

import com.omniflow.crm.service.ContactImportProcessor;
import com.omniflow.crm.service.ContactImportStorage;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Recovers imports whose worker died mid-run and reaps abandoned upload
 * sessions. Safe to run on every worker replica: the claim update in
 * {@link ContactImportProcessor} is atomic.
 */
@Component
@Profile("worker")
@RequiredArgsConstructor
public class ContactImportMaintenanceScheduler {

    private static final Logger log = LoggerFactory.getLogger(ContactImportMaintenanceScheduler.class);

    private final JdbcTemplate jdbcTemplate;
    private final ContactImportProcessor importProcessor;
    private final ContactImportStorage storage;

    @Scheduled(
            fixedDelayString = "${omniflow.import.recovery-interval-ms:60000}",
            initialDelayString = "${omniflow.import.recovery-initial-delay-ms:45000}")
    public void recoverStalledImports() {
        List<Map<String, Object>> jobs = jdbcTemplate.queryForList("""
                select id, organization_id
                  from contact_imports
                 where status in ('QUEUED','RUNNING')
                   and (locked_until is null or locked_until < now())
                   and updated_at < now() - interval '30 seconds'
                 order by created_at
                 limit 20
                """);
        for (Map<String, Object> job : jobs) {
            UUID importId = (UUID) job.get("id");
            UUID organizationId = (UUID) job.get("organization_id");
            try {
                importProcessor.process(organizationId, importId);
            } catch (RuntimeException ex) {
                log.warn("Recovery attempt for import {} failed: {}", importId, ex.getMessage());
            }
        }
    }

    @Scheduled(
            fixedDelayString = "${omniflow.import.cleanup-interval-ms:3600000}",
            initialDelayString = "${omniflow.import.cleanup-initial-delay-ms:120000}")
    public void cleanAbandonedUploads() {
        List<Map<String, Object>> abandoned = jdbcTemplate.queryForList("""
                select id, organization_id
                  from contact_imports
                 where status = 'UPLOADING'
                   and updated_at < now() - interval '7 days'
                 limit 100
                """);
        for (Map<String, Object> job : abandoned) {
            UUID importId = (UUID) job.get("id");
            UUID organizationId = (UUID) job.get("organization_id");
            jdbcTemplate.update("""
                    update contact_imports
                       set status = 'FAILED',
                           last_error = 'The upload session expired before it was completed',
                           completed_at = now(),
                           updated_at = now()
                     where id = ? and organization_id = ? and status = 'UPLOADING'
                    """, importId, organizationId);
            storage.deleteJob(organizationId, importId);
            log.info("Expired abandoned contact upload {}", importId);
        }

        List<Map<String, Object>> leftover = jdbcTemplate.queryForList("""
                select id, organization_id
                  from contact_imports
                 where status in ('COMPLETED','PARTIAL','CANCELLED')
                   and completed_at < now() - interval '1 day'
                 limit 100
                """);
        for (Map<String, Object> job : leftover) {
            storage.deleteJob((UUID) job.get("organization_id"), (UUID) job.get("id"));
        }
    }
}
