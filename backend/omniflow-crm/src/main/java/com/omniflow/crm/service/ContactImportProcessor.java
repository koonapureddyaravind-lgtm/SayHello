package com.omniflow.crm.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omniflow.crm.domain.ContactImport;
import com.omniflow.crm.repository.ContactImportRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Worker-side driver for a bulk contact import. Claims the job row, streams the
 * staged CSV, and commits one transaction per batch.
 */
@Component
@Profile("worker")
@RequiredArgsConstructor
public class ContactImportProcessor {

    private static final Logger log = LoggerFactory.getLogger(ContactImportProcessor.class);
    private static final int MIN_BATCH_SIZE = 100;
    private static final int MAX_BATCH_SIZE = 20_000;

    private final ContactImportRepository importRepository;
    private final ContactImportStorage storage;
    private final ContactImportMappingResolver mappingResolver;
    private final ContactImportRowParser rowParser;
    private final ContactImportBatchWriter batchWriter;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Value("${omniflow.import.lock-seconds:3600}")
    private long lockSeconds;

    @Value("${omniflow.import.max-attempts:5}")
    private int maxAttempts;

    public void process(UUID organizationId, UUID importId) {
        UUID lockToken = UUID.randomUUID();
        Instant lockedUntil = Instant.now().plusSeconds(Math.max(60, lockSeconds));

        int claimed = jdbcTemplate.update("""
                update contact_imports
                   set status = 'RUNNING',
                       lock_token = ?,
                       locked_until = ?,
                       started_at = coalesce(started_at, now()),
                       attempts = attempts + 1,
                       last_error = null,
                       updated_at = now()
                 where id = ?
                   and organization_id = ?
                   and status in ('QUEUED','RUNNING')
                   and (locked_until is null or locked_until < now())
                """, lockToken, Timestamp.from(lockedUntil), importId, organizationId);
        if (claimed == 0) {
            log.debug("Contact import {} is not claimable (completed, cancelled or held by another worker)", importId);
            return;
        }

        ContactImport importJob = importRepository.findByIdAndOrganizationId(importId, organizationId)
                .orElse(null);
        if (importJob == null) {
            return;
        }
        if (importJob.getAttempts() > maxAttempts) {
            fail(organizationId, importId, lockToken,
                    "The import exceeded " + maxAttempts + " attempts. Retry it when the file is available.");
            return;
        }

        try {
            run(organizationId, importJob, lockToken);
        } catch (Exception ex) {
            if (isCancelled(organizationId, importId)) {
                cleanup(organizationId, importId);
                return;
            }
            handleFailure(organizationId, importId, lockToken, ex);
            throw ex instanceof RuntimeException runtime ? runtime
                    : new IllegalStateException("Contact import failed", ex);
        }
    }

    private void run(UUID organizationId, ContactImport importJob, UUID lockToken) throws IOException {
        UUID importId = importJob.getId();
        int totalChunks = importJob.getTotalChunks();

        boolean assembled = Files.isRegularFile(storage.uploadPath(organizationId, importId));
        if (!assembled && !storage.hasAllParts(organizationId, importId, totalChunks)) {
            fail(organizationId, importId, lockToken,
                    "The upload is incomplete. Resume the upload before starting the import.");
            return;
        }

        ContactImportStorage.AssemblyResult assembly =
                storage.assembleIfNeeded(organizationId, importId, totalChunks);
        long estimatedRows = importJob.getEstimatedTotalRows();
        if (assembly.assembled()) {
            estimatedRows = Math.max(0, assembly.newlineCount() - 1);
            jdbcTemplate.update("""
                    update contact_imports
                       set file_size_bytes = ?,
                           estimated_total_rows = ?,
                           updated_at = now()
                     where id = ? and organization_id = ?
                    """, assembly.sizeBytes(), estimatedRows, importId, organizationId);
        }

        List<String> headers = importJob.getHeaderColumns();
        if (headers == null || headers.isEmpty()) {
            headers = mappingResolver.detect(storage.readHeaderPrefix(organizationId, importId)).headers();
            jdbcTemplate.update("update contact_imports set header_columns = ?::jsonb where id = ?",
                    toJson(headers), importId);
        }

        ContactImportRowParser.ColumnLayout layout = rowParser.layout(
                headers, importJob.getColumnMapping(), importJob.getAttributeMapping());
        char delimiter = resolveDelimiter(importJob.getDelimiter());
        int batchSize = clampBatchSize(importJob.getBatchSize());

        long resumeOffset = Math.max(0, importJob.getResumeCharOffset());
        long totalRows = importJob.getTotalRows();
        long nextOffset = resumeOffset;

        try (ContactImportCsvReader reader =
                     new ContactImportCsvReader(storage.uploadPath(organizationId, importId), delimiter, resumeOffset)) {
            if (resumeOffset == 0) {
                List<String> header = reader.next();
                if (header == null) {
                    fail(organizationId, importId, lockToken, "The uploaded file is empty");
                    return;
                }
            }

            List<ContactImportRowParser.ParsedRow> batch = new ArrayList<>(batchSize);
            boolean done = false;
            while (!done) {
                List<String> record = reader.next();
                if (record == null) {
                    done = true;
                } else {
                    if (!isEmpty(record)) {
                        totalRows++;
                        batch.add(rowParser.parse(record, layout, totalRows));
                    }
                    nextOffset = reader.offset();
                }

                if (batch.size() >= batchSize || (done && !batch.isEmpty())) {
                    if (isCancelled(organizationId, importId)) {
                        cleanup(organizationId, importId);
                        return;
                    }
                    batchWriter.write(organizationId, importJob, lockToken, batch, totalRows, nextOffset);
                    batch.clear();
                }
            }
            nextOffset = reader.offset();
        }

        if (isCancelled(organizationId, importId)) {
            cleanup(organizationId, importId);
            return;
        }
        complete(organizationId, importId, lockToken, totalRows, nextOffset);
        storage.deleteJob(organizationId, importId);
        log.info("Contact import {} completed: {} rows", importId, totalRows);
    }

    private void complete(UUID organizationId, UUID importId, UUID lockToken,
                          long totalRows, long nextOffset) {
        Boolean partial = jdbcTemplate.queryForObject("""
                select (error_count > 0 or skipped_count > 0)
                  from contact_imports
                 where id = ? and organization_id = ?
                """, Boolean.class, importId, organizationId);
        String status = Boolean.TRUE.equals(partial) ? "PARTIAL" : "COMPLETED";
        int changed = jdbcTemplate.update("""
                update contact_imports
                   set status = ?,
                       total_rows = greatest(total_rows, ?),
                       resume_char_offset = ?,
                       completed_at = now(),
                       lock_token = null,
                       locked_until = null,
                       last_error = null,
                       updated_at = now()
                 where id = ?
                   and organization_id = ?
                   and lock_token = ?
                """, status, totalRows, nextOffset, importId, organizationId, lockToken);
        if (changed == 0) {
            log.warn("Contact import {} was cancelled or taken over before completion", importId);
        }
    }

    private boolean isCancelled(UUID organizationId, UUID importId) {
        String status = jdbcTemplate.queryForObject("""
                select status from contact_imports where id = ? and organization_id = ?
                """, String.class, importId, organizationId);
        return "CANCELLED".equals(status);
    }

    private void cleanup(UUID organizationId, UUID importId) {
        storage.deleteJob(organizationId, importId);
        log.info("Contact import {} stopped because it was cancelled", importId);
    }

    private void fail(UUID organizationId, UUID importId, UUID lockToken, String message) {
        jdbcTemplate.update("""
                update contact_imports
                   set status = 'FAILED',
                       last_error = ?,
                       completed_at = now(),
                       lock_token = null,
                       locked_until = null,
                       updated_at = now()
                 where id = ?
                   and organization_id = ?
                   and lock_token = ?
                """, truncate(message), importId, organizationId, lockToken);
    }

    private void handleFailure(UUID organizationId, UUID importId, UUID lockToken, Exception ex) {
        String message = ex.getMessage() == null || ex.getMessage().isBlank()
                ? ex.getClass().getSimpleName() : ex.getMessage();
        Integer attempts = jdbcTemplate.queryForObject("""
                select attempts from contact_imports where id = ? and organization_id = ?
                """, Integer.class, importId, organizationId);
        boolean finalFailure = attempts != null && attempts >= maxAttempts;
        jdbcTemplate.update("""
                update contact_imports
                   set status = ?,
                       last_error = ?,
                       completed_at = case when ? then now() else completed_at end,
                       lock_token = null,
                       locked_until = null,
                       updated_at = now()
                 where id = ?
                   and organization_id = ?
                   and status = 'RUNNING'
                   and (lock_token = ? or lock_token is null)
                """, finalFailure ? "FAILED" : "QUEUED", truncate(message), finalFailure,
                importId, organizationId, lockToken);
        log.error("Contact import {} failed on attempt {}: {}", importId, attempts, message, ex);
    }

    private boolean isEmpty(List<String> record) {
        for (String value : record) {
            if (value != null && !value.isBlank()) {
                return false;
            }
        }
        return true;
    }

    private int clampBatchSize(int requested) {
        return Math.max(MIN_BATCH_SIZE, Math.min(MAX_BATCH_SIZE, requested));
    }

    private char resolveDelimiter(String value) {
        return value == null || value.isEmpty() ? ',' : value.charAt(0);
    }

    private String toJson(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private String truncate(String value) {
        if (value == null) {
            return null;
        }
        return value.length() <= 2000 ? value : value.substring(0, 2000);
    }
}
