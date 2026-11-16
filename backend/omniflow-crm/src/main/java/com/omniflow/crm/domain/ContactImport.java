package com.omniflow.crm.domain;

import com.omniflow.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Durable state for a bulk contact import. Large files are staged on disk and
 * processed by the worker in resumable batches; this row is the source of truth.
 */
@Entity
@Table(name = "contact_imports")
@Getter
@Setter
public class ContactImport extends BaseEntity {

    @Column(name = "organization_id", nullable = false, updatable = false)
    private UUID organizationId;

    @Column(name = "created_by", updatable = false)
    private UUID createdBy;

    @Column(name = "original_filename", nullable = false, updatable = false)
    private String originalFilename;

    @Column(name = "status", nullable = false)
    private String status = "UPLOADING";

    @Column(name = "file_size_bytes", nullable = false)
    private long fileSizeBytes;

    @Column(name = "uploaded_bytes", nullable = false)
    private long uploadedBytes;

    @Column(name = "uploaded_chunks", nullable = false)
    private int uploadedChunks;

    @Column(name = "total_chunks", nullable = false)
    private int totalChunks;

    @Column(name = "delimiter", nullable = false)
    private String delimiter = ",";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "header_columns", nullable = false, columnDefinition = "jsonb")
    private List<String> headerColumns = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "column_mapping", nullable = false, columnDefinition = "jsonb")
    private Map<String, String> columnMapping = new LinkedHashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "attribute_mapping", nullable = false, columnDefinition = "jsonb")
    private Map<String, String> attributeMapping = new LinkedHashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tag_names", nullable = false, columnDefinition = "jsonb")
    private List<String> tagNames = new ArrayList<>();

    @Column(name = "source_label")
    private String sourceLabel;

    @Column(name = "trigger_automations", nullable = false)
    private boolean triggerAutomations;

    @Column(name = "record_activities", nullable = false)
    private boolean recordActivities;

    @Column(name = "estimated_total_rows", nullable = false)
    private long estimatedTotalRows;

    @Column(name = "total_rows", nullable = false)
    private long totalRows;

    @Column(name = "processed_rows", nullable = false)
    private long processedRows;

    @Column(name = "created_count", nullable = false)
    private long createdCount;

    @Column(name = "updated_count", nullable = false)
    private long updatedCount;

    @Column(name = "skipped_count", nullable = false)
    private long skippedCount;

    @Column(name = "failed_count", nullable = false)
    private long failedCount;

    @Column(name = "error_count", nullable = false)
    private long errorCount;

    @Column(name = "resume_char_offset", nullable = false)
    private long resumeCharOffset;

    @Column(name = "batch_size", nullable = false)
    private int batchSize = 5000;

    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "lock_token")
    private UUID lockToken;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;
}
