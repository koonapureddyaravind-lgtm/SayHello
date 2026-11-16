package com.omniflow.crm.service;

import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.config.MessagingTopology;
import com.omniflow.common.exception.BadRequestException;
import com.omniflow.common.exception.ConflictException;
import com.omniflow.common.exception.NotFoundException;
import com.omniflow.common.outbox.OutboxWriter;
import com.omniflow.crm.domain.ContactImport;
import com.omniflow.crm.dto.CompleteContactImportRequest;
import com.omniflow.crm.dto.ContactImportErrorView;
import com.omniflow.crm.dto.ContactImportView;
import com.omniflow.crm.dto.CreateContactImportRequest;
import com.omniflow.crm.repository.ContactImportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Chunked, resumable upload lifecycle for large contact files. Bytes are staged
 * on disk; the worker owns the CPU-heavy parsing and database work.
 */
@Service
@RequiredArgsConstructor
public class ContactImportService {

    private static final int MAX_CHUNKS = 500_000;
    private static final int MIN_BATCH_SIZE = 100;
    private static final int MAX_BATCH_SIZE = 20_000;
    private static final int DEFAULT_BATCH_SIZE = 5_000;

    private final ContactImportRepository importRepository;
    private final ContactImportStorage storage;
    private final ContactImportMappingResolver mappingResolver;
    private final OutboxWriter outboxWriter;
    private final JdbcTemplate jdbcTemplate;
    private final TransactionTemplate transactionTemplate;

    @Value("${omniflow.import.max-file-bytes:0}")
    private long maxFileBytes;

    public ContactImportView create(UUID organizationId, UUID actorId, CreateContactImportRequest request) {
        String filename = request.filename() == null ? "" : request.filename().trim();
        if (filename.isEmpty()) {
            throw new BadRequestException("IMPORT_FILENAME_REQUIRED", "A file name is required");
        }
        if (filename.length() > 500) {
            filename = filename.substring(0, 500);
        }
        if (request.totalChunks() < 1 || request.totalChunks() > MAX_CHUNKS) {
            throw new BadRequestException("IMPORT_CHUNK_COUNT_INVALID",
                    "The file must be split into between 1 and " + MAX_CHUNKS + " chunks");
        }
        if (request.sizeBytes() < 0) {
            throw new BadRequestException("IMPORT_SIZE_INVALID", "The file size cannot be negative");
        }
        if (maxFileBytes > 0 && request.sizeBytes() > maxFileBytes) {
            throw new BadRequestException("IMPORT_TOO_LARGE",
                    "Files larger than " + maxFileBytes + " bytes are not allowed");
        }

        ContactImport job = new ContactImport();
        job.setOrganizationId(organizationId);
        job.setCreatedBy(actorId);
        job.setOriginalFilename(filename);
        job.setStatus("UPLOADING");
        job.setFileSizeBytes(request.sizeBytes());
        job.setTotalChunks(request.totalChunks());
        job.setEstimatedTotalRows(0);
        job.setBatchSize(DEFAULT_BATCH_SIZE);
        job = importRepository.save(job);
        storage.initialize(organizationId, job.getId());
        return toView(job);
    }

    public ContactImportView uploadChunk(UUID organizationId, UUID importId, int index,
                                         MultipartFile chunk) {
        if (chunk == null) {
            throw new BadRequestException("IMPORT_CHUNK_REQUIRED", "A chunk payload is required");
        }
        ContactImport current = require(organizationId, importId);
        if (!"UPLOADING".equals(current.getStatus())) {
            throw new ConflictException("IMPORT_NOT_UPLOADING",
                    "This import is no longer accepting uploads");
        }
        if (index < 0 || index >= current.getTotalChunks()) {
            throw new BadRequestException("IMPORT_CHUNK_INDEX_INVALID",
                    "Chunk index must be between 0 and " + (current.getTotalChunks() - 1));
        }

        ContactImportStorage.StagedPart staged;
        try {
            staged = storage.stagePart(organizationId, importId, index, chunk.getInputStream());
        } catch (java.io.IOException ex) {
            throw new BadRequestException("IMPORT_CHUNK_FAILED", "Unable to read the uploaded chunk");
        }

        try {
            return transactionTemplate.execute(status -> {
                ContactImport job = requireForUpdate(organizationId, importId);
                if (!"UPLOADING".equals(job.getStatus())) {
                    throw new ConflictException("IMPORT_NOT_UPLOADING",
                            "This import is no longer accepting uploads");
                }
                ContactImportStorage.PartCommit commit =
                        storage.commitPart(organizationId, importId, index, staged);
                long delta = commit.sizeBytes() - commit.previousSizeBytes();
                job.setUploadedBytes(Math.max(0, job.getUploadedBytes() + delta));
                if (!commit.existed()) {
                    job.setUploadedChunks(job.getUploadedChunks() + 1);
                }
                if (job.getHeaderColumns() == null || job.getHeaderColumns().isEmpty()) {
                    byte[] prefix = storage.readHeaderPrefix(organizationId, importId);
                    if (prefix.length > 0) {
                        ContactImportMappingResolver.DetectedFormat detected =
                                mappingResolver.detect(prefix);
                        job.setDelimiter(detected.delimiter());
                        job.setHeaderColumns(detected.headers());
                    }
                }
                return toView(importRepository.save(job));
            });
        } catch (RuntimeException ex) {
            storage.discard(staged);
            throw ex;
        }
    }

    public ContactImportView complete(UUID organizationId, UUID importId,
                                      CompleteContactImportRequest request) {
        return transactionTemplate.execute(status -> {
            ContactImport job = requireForUpdate(organizationId, importId);
            if ("QUEUED".equals(job.getStatus()) || "RUNNING".equals(job.getStatus())) {
                return toView(job);
            }
            if (!"UPLOADING".equals(job.getStatus())) {
                throw new ConflictException("IMPORT_NOT_UPLOADING",
                        "Only an upload in progress can be started");
            }
            if (!storage.hasAllParts(organizationId, importId, job.getTotalChunks())) {
                throw new BadRequestException("IMPORT_UPLOAD_INCOMPLETE",
                        "Upload every chunk before starting the import");
            }

            byte[] prefix = storage.readHeaderPrefix(organizationId, importId);
            ContactImportMappingResolver.DetectedFormat detected = mappingResolver.detect(prefix);
            List<String> headers = detected.headers();
            Map<String, String> mapping = mappingResolver.validateMapping(
                    headers, request == null ? null : request.mapping());
            Map<String, String> attributeMapping = mappingResolver.validateAttributeMapping(
                    headers, mapping, request == null ? null : request.attributeMapping());
            List<String> tags = mappingResolver.sanitizeTags(
                    request == null ? null : request.tags());

            int batchSize = request == null || request.batchSize() == null
                    ? DEFAULT_BATCH_SIZE : clampBatchSize(request.batchSize());
            String sourceLabel = request == null || request.sourceLabel() == null
                    || request.sourceLabel().isBlank() ? "IMPORT" : request.sourceLabel().trim();
            if (sourceLabel.length() > 120) {
                sourceLabel = sourceLabel.substring(0, 120);
            }

            job.setDelimiter(detected.delimiter());
            job.setHeaderColumns(headers);
            job.setColumnMapping(mapping);
            job.setAttributeMapping(attributeMapping);
            job.setTagNames(tags);
            job.setSourceLabel(sourceLabel);
            job.setTriggerAutomations(request != null && Boolean.TRUE.equals(request.triggerAutomations()));
            job.setRecordActivities(request != null && Boolean.TRUE.equals(request.recordActivities()));
            job.setBatchSize(batchSize);
            job.setEstimatedTotalRows(estimateRows(prefix, job.getFileSizeBytes()));
            job.setStatus("QUEUED");
            job.setLastError(null);
            job = importRepository.save(job);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("importId", job.getId());
            payload.put("organizationId", organizationId);
            payload.put("filename", job.getOriginalFilename());
            outboxWriter.write("contact_import", job.getId(),
                    MessagingTopology.CONTACT_IMPORT_REQUESTED, organizationId, payload);
            return toView(job);
        });
    }

    public ContactImportView cancel(UUID organizationId, UUID importId) {
        String[] previousStatus = new String[1];
        ContactImport job = transactionTemplate.execute(status -> {
            ContactImport locked = requireForUpdate(organizationId, importId);
            previousStatus[0] = locked.getStatus();
            if (isTerminal(locked.getStatus())) {
                return locked;
            }
            locked.setStatus("CANCELLED");
            locked.setCompletedAt(Instant.now());
            locked.setLockToken(null);
            locked.setLockedUntil(null);
            return importRepository.save(locked);
        });
        if (job != null && !"RUNNING".equals(previousStatus[0])) {
            storage.deleteJob(organizationId, importId);
        }
        return toView(job);
    }

    public ContactImportView retry(UUID organizationId, UUID importId) {
        return transactionTemplate.execute(status -> {
            ContactImport job = requireForUpdate(organizationId, importId);
            if (!"FAILED".equals(job.getStatus()) && !"CANCELLED".equals(job.getStatus())) {
                throw new ConflictException("IMPORT_NOT_RETRYABLE",
                        "Only failed or cancelled imports can be retried");
            }
            boolean fileAvailable = java.nio.file.Files.isRegularFile(
                    storage.uploadPath(organizationId, importId))
                    || storage.hasAllParts(organizationId, importId, job.getTotalChunks());
            if (!fileAvailable) {
                throw new BadRequestException("IMPORT_FILE_EXPIRED",
                        "The staged file is no longer available. Start a new upload.");
            }
            job.setStatus("QUEUED");
            job.setCompletedAt(null);
            job.setLastError(null);
            job.setLockToken(null);
            job.setLockedUntil(null);
            job = importRepository.save(job);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("importId", job.getId());
            payload.put("organizationId", organizationId);
            payload.put("filename", job.getOriginalFilename());
            outboxWriter.write("contact_import", job.getId(),
                    MessagingTopology.CONTACT_IMPORT_REQUESTED, organizationId, payload);
            return toView(job);
        });
    }

    public ContactImportView get(UUID organizationId, UUID importId) {
        return toView(require(organizationId, importId));
    }

    public PageResponse<ContactImportView> list(UUID organizationId, PageQuery pageQuery) {
        Page<ContactImport> page = importRepository.findByOrganizationIdOrderByCreatedAtDesc(
                organizationId, pageQuery.toPageRequest());
        return PageResponse.of(
                page.getContent().stream().map(this::toView).toList(),
                page.getNumber(), page.getSize(), page.getTotalElements());
    }

    public PageResponse<ContactImportErrorView> errors(UUID organizationId, UUID importId,
                                                       PageQuery pageQuery) {
        require(organizationId, importId);
        long offset = (long) pageQuery.page() * pageQuery.size();
        List<ContactImportErrorView> items = jdbcTemplate.query("""
                        select row_number, message, created_at
                          from contact_import_errors
                         where import_id = ? and organization_id = ?
                         order by id
                         limit ? offset ?
                        """,
                (rs, rowNum) -> new ContactImportErrorView(
                        rs.getObject("row_number") == null ? 0L : rs.getLong("row_number"),
                        rs.getString("message"),
                        rs.getTimestamp("created_at").toInstant()),
                importId, organizationId, pageQuery.size(), offset);
        Long total = jdbcTemplate.queryForObject("""
                select count(*) from contact_import_errors where import_id = ? and organization_id = ?
                """, Long.class, importId, organizationId);
        return PageResponse.of(items, pageQuery.page(), pageQuery.size(), total == null ? 0 : total);
    }

    public String errorsCsv(UUID organizationId, UUID importId) {
        require(organizationId, importId);
        List<ContactImportErrorView> rows = jdbcTemplate.query("""
                        select row_number, message, created_at
                          from contact_import_errors
                         where import_id = ? and organization_id = ?
                         order by id
                         limit 10000
                        """,
                (rs, rowNum) -> new ContactImportErrorView(
                        rs.getObject("row_number") == null ? 0L : rs.getLong("row_number"),
                        rs.getString("message"),
                        rs.getTimestamp("created_at").toInstant()),
                importId, organizationId);
        StringBuilder csv = new StringBuilder("row_number,message,created_at\n");
        for (ContactImportErrorView row : rows) {
            csv.append(row.rowNumber()).append(',')
                    .append(escape(row.message())).append(',')
                    .append(row.createdAt()).append('\n');
        }
        return csv.toString();
    }

    @Transactional
    public void delete(UUID organizationId, UUID importId) {
        ContactImport job = requireForUpdate(organizationId, importId);
        if ("RUNNING".equals(job.getStatus())) {
            throw new ConflictException("IMPORT_RUNNING", "Cancel the import before deleting it");
        }
        importRepository.delete(job);
        storage.deleteJob(organizationId, importId);
    }

    private ContactImport require(UUID organizationId, UUID importId) {
        return importRepository.findByIdAndOrganizationId(importId, organizationId)
                .orElseThrow(() -> new NotFoundException("ContactImport", importId));
    }

    private ContactImport requireForUpdate(UUID organizationId, UUID importId) {
        return importRepository.findForUpdate(importId, organizationId)
                .orElseThrow(() -> new NotFoundException("ContactImport", importId));
    }

    private ContactImportView toView(ContactImport job) {
        if (job == null) {
            return null;
        }
        Integer progress = progress(job);
        return new ContactImportView(
                job.getId(),
                job.getOrganizationId(),
                job.getOriginalFilename(),
                job.getStatus(),
                job.getFileSizeBytes(),
                job.getUploadedBytes(),
                job.getUploadedChunks(),
                job.getTotalChunks(),
                job.getDelimiter(),
                job.getHeaderColumns() == null ? List.of() : List.copyOf(job.getHeaderColumns()),
                job.getColumnMapping() == null ? Map.of() : Map.copyOf(job.getColumnMapping()),
                job.getAttributeMapping() == null ? Map.of() : Map.copyOf(job.getAttributeMapping()),
                job.getTagNames() == null ? List.of() : List.copyOf(job.getTagNames()),
                job.getEstimatedTotalRows(),
                job.getTotalRows(),
                job.getProcessedRows(),
                job.getCreatedCount(),
                job.getUpdatedCount(),
                job.getSkippedCount(),
                job.getFailedCount(),
                job.getErrorCount(),
                progress,
                job.getLastError(),
                job.getCreatedAt(),
                job.getUpdatedAt(),
                job.getStartedAt(),
                job.getCompletedAt());
    }

    private Integer progress(ContactImport job) {
        if (job == null) {
            return null;
        }
        if (isTerminal(job.getStatus())) {
            return 100;
        }
        if ("UPLOADING".equals(job.getStatus())) {
            if (job.getTotalChunks() <= 0) {
                return 0;
            }
            return (int) Math.min(99,
                    Math.round(job.getUploadedChunks() * 100.0 / job.getTotalChunks()));
        }
        long denominator = job.getEstimatedTotalRows() > 0
                ? job.getEstimatedTotalRows() : job.getTotalRows();
        if (denominator <= 0) {
            return 0;
        }
        return (int) Math.min(99, Math.max(0,
                Math.round(job.getProcessedRows() * 100.0 / denominator)));
    }

    private boolean isTerminal(String status) {
        return status != null && switch (status) {
            case "COMPLETED", "PARTIAL", "FAILED", "CANCELLED" -> true;
            default -> false;
        };
    }

    private int clampBatchSize(int requested) {
        return Math.max(MIN_BATCH_SIZE, Math.min(MAX_BATCH_SIZE, requested));
    }

    private long estimateRows(byte[] prefix, long fileSizeBytes) {
        if (prefix == null || prefix.length == 0 || fileSizeBytes <= 0) {
            return 0;
        }
        long newlines = 0;
        for (byte value : prefix) {
            if (value == '\n') {
                newlines++;
            }
        }
        if (newlines <= 0) {
            return 0;
        }
        long estimate = Math.round((double) fileSizeBytes / prefix.length * newlines) - 1;
        return Math.max(0, estimate);
    }

    private String escape(String value) {
        if (value == null) {
            return "";
        }
        String escaped = value.replace("\"", "\"\"");
        return "\"" + escaped + "\"";
    }
}
