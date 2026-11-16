package com.omniflow.crm.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omniflow.crm.domain.ContactImport;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Applies a parsed batch to PostgreSQL with set-based SQL.
 *
 * <p>Every batch runs in one transaction together with the job progress update.
 * If anything fails, the committed offset and the contact rows roll back
 * together, so a retry re-reads the same records. Upserts are keyed by email or
 * phone, which makes replaying an already committed batch harmless.</p>
 */
@Component
@RequiredArgsConstructor
public class ContactImportBatchWriter {

    static final int MAX_STORED_ERRORS = 500;
    private static final String TAG_SEPARATOR = "\u001F";

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public BatchResult write(UUID organizationId, ContactImport importJob, UUID lockToken,
                             List<ContactImportRowParser.ParsedRow> rows, long totalRows,
                             long nextOffset) {
        createTemporaryTables();

        long skipped = 0;
        long failed = 0;
        List<ImportErrorSample> errors = new ArrayList<>();
        List<ContactImportRowParser.ParsedRow> accepted = new ArrayList<>(rows.size());

        Map<String, Long> seen = new HashMap<>();
        for (ContactImportRowParser.ParsedRow row : rows) {
            if (!row.valid()) {
                skipped++;
                errors.add(new ImportErrorSample(row.rowNumber(), row.error()));
                continue;
            }
            String key = identityKey(row);
            Long previous = key == null ? null : seen.putIfAbsent(key, row.rowNumber());
            if (previous != null) {
                skipped++;
                errors.add(new ImportErrorSample(row.rowNumber(),
                        "Row " + row.rowNumber() + ": duplicates row " + previous
                                + " in this upload batch"));
                continue;
            }
            accepted.add(row);
        }

        insertRows(organizationId, importJob, accepted);
        matchExistingContacts(organizationId);
        markConflictingIdentities(organizationId);
        updateMatchedContacts();
        insertNewContacts(organizationId, importJob);
        markCreatedContacts(organizationId);
        markUnresolvedRows();

        long created = countOutcome("CREATED");
        long updated = countOutcome("UPDATED");
        failed += countOutcome("FAILED");

        Long alreadyStoredValue = jdbcTemplate.queryForObject("""
                select count(*) from contact_import_errors
                 where import_id = ? and organization_id = ?
                """, Long.class, importJob.getId(), organizationId);
        long alreadyStored = alreadyStoredValue == null ? 0L : alreadyStoredValue;
        int room = Math.max(0, MAX_STORED_ERRORS - (int) Math.min(MAX_STORED_ERRORS, alreadyStored));
        if (errors.size() > room) {
            errors = new ArrayList<>(errors.subList(0, room));
        }
        errors.addAll(loadDatabaseErrors(room - errors.size()));
        storeErrors(organizationId, importJob.getId(), errors);

        applyTags(organizationId);

        long errorCount = skipped + failed;
        updateProgress(organizationId, importJob.getId(), lockToken, rows.size(), created, updated,
                skipped, failed, errorCount, totalRows, nextOffset);

        return new BatchResult(rows.size(), created, updated, skipped, failed, errorCount, nextOffset);
    }

    private void createTemporaryTables() {
        jdbcTemplate.execute("""
                create temp table tmp_import_rows (
                  row_number  bigint primary key,
                  email       text,
                  phone       text,
                  first_name  text,
                  last_name   text,
                  status      text,
                  external_id text,
                  attributes  jsonb,
                  tags        text,
                  outcome     text,
                  error       text,
                  matched_id  uuid
                ) on commit drop
                """);
    }

    private void insertRows(UUID organizationId,
                            ContactImport importJob,
                            List<ContactImportRowParser.ParsedRow> rows) {
        if (rows.isEmpty()) {
            return;
        }
        String sql = """
                insert into tmp_import_rows
                  (row_number, email, phone, first_name, last_name, status,
                   external_id, attributes, tags)
                values (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)
                """;
        List<String> jobTags = importJob.getTagNames() == null ? List.of() : importJob.getTagNames();
        jdbcTemplate.batchUpdate(sql, rows, rows.size(), (statement, row) -> {
            statement.setLong(1, row.rowNumber());
            setNullable(statement, 2, row.email());
            setNullable(statement, 3, row.phone());
            setNullable(statement, 4, row.firstName());
            setNullable(statement, 5, row.lastName());
            setNullable(statement, 6, row.status());
            setNullable(statement, 7, row.externalId());
            statement.setString(8, json(row.attributes()));
            statement.setString(9, joinedTags(jobTags, row.tags()));
        });
    }

    private void matchExistingContacts(UUID organizationId) {
        jdbcTemplate.update("""
                update tmp_import_rows t
                   set matched_id = c.id,
                       outcome = 'UPDATED'
                  from contacts c
                 where c.organization_id = ?
                   and c.deleted_at is null
                   and t.email is not null
                   and lower(c.email) = t.email
                """, organizationId);

        jdbcTemplate.update("""
                update tmp_import_rows t
                   set matched_id = c.id,
                       outcome = 'UPDATED'
                  from contacts c
                 where t.matched_id is null
                   and t.phone is not null
                   and c.organization_id = ?
                   and c.deleted_at is null
                   and c.phone = t.phone
                """, organizationId);
    }

    private void markConflictingIdentities(UUID organizationId) {
        jdbcTemplate.update("""
                update tmp_import_rows t
                   set outcome = 'FAILED',
                       error = 'Row ' || t.row_number
                               || ': email and phone belong to different contacts'
                  from contacts c
                 where t.matched_id is not null
                   and t.phone is not null
                   and c.organization_id = ?
                   and c.deleted_at is null
                   and c.phone = t.phone
                   and c.id <> t.matched_id
                """, organizationId);
    }

    private void updateMatchedContacts() {
        jdbcTemplate.update("""
                update contacts c
                   set email       = coalesce(t.email, c.email),
                       phone       = coalesce(t.phone, c.phone),
                       first_name  = coalesce(t.first_name, c.first_name),
                       last_name   = coalesce(t.last_name, c.last_name),
                       status      = coalesce(t.status, c.status),
                       external_id = coalesce(t.external_id, c.external_id),
                       attributes  = c.attributes || coalesce(t.attributes, '{}'::jsonb),
                       updated_at  = now()
                  from tmp_import_rows t
                 where t.matched_id = c.id
                   and t.outcome = 'UPDATED'
                   and t.error is null
                """);
    }

    private void insertNewContacts(UUID organizationId, ContactImport importJob) {
        String source = importJob.getSourceLabel() == null || importJob.getSourceLabel().isBlank()
                ? "IMPORT" : importJob.getSourceLabel().trim();
        jdbcTemplate.update("""
                insert into contacts
                  (id, organization_id, external_id, email, phone, first_name, last_name,
                   status, source, attributes, created_at, updated_at)
                select gen_random_uuid(), ?, t.external_id, t.email, t.phone, t.first_name,
                       t.last_name, coalesce(t.status, 'ACTIVE'), ?,
                       coalesce(t.attributes, '{}'::jsonb), now(), now()
                  from tmp_import_rows t
                 where t.matched_id is null
                   and t.error is null
                on conflict do nothing
                """, organizationId, source);
    }

    private void markCreatedContacts(UUID organizationId) {
        jdbcTemplate.update("""
                update tmp_import_rows t
                   set matched_id = c.id,
                       outcome = 'CREATED'
                  from contacts c
                 where t.matched_id is null
                   and t.error is null
                   and c.organization_id = ?
                   and c.deleted_at is null
                   and ((t.email is not null and lower(c.email) = t.email)
                        or (t.email is null and t.phone is not null and c.phone = t.phone))
                """, organizationId);
    }

    private void markUnresolvedRows() {
        jdbcTemplate.update("""
                update tmp_import_rows t
                   set outcome = 'FAILED',
                       error = 'Row ' || t.row_number
                               || ': duplicates an existing contact'
                 where t.matched_id is null
                   and t.error is null
                """);
    }

    private void applyTags(UUID organizationId) {
        jdbcTemplate.update("""
                insert into tags (id, organization_id, name, color, created_at)
                select gen_random_uuid(), ?, tag.name, '#64748b', now()
                  from (
                    select distinct on (lower(btrim(tag_value))) btrim(tag_value) as name
                      from tmp_import_rows r,
                           string_to_table(coalesce(r.tags, ''), ?::text) tag_value
                     where btrim(tag_value) <> ''
                     order by lower(btrim(tag_value)), btrim(tag_value)
                  ) tag
                 where not exists (
                    select 1 from tags existing
                     where existing.organization_id = ?
                       and lower(existing.name) = lower(tag.name))
                on conflict (organization_id, name) do nothing
                """, organizationId, TAG_SEPARATOR, organizationId);

        jdbcTemplate.update("""
                insert into contact_tags (contact_id, tag_id, created_at)
                select distinct r.matched_id, tg.id, now()
                  from tmp_import_rows r
                  cross join lateral string_to_table(coalesce(r.tags, ''), ?::text) tag_value
                  join tags tg on tg.organization_id = ?
                              and lower(tg.name) = lower(btrim(tag_value))
                 where r.matched_id is not null
                   and r.outcome in ('CREATED','UPDATED')
                   and btrim(tag_value) <> ''
                on conflict do nothing
                """, TAG_SEPARATOR, organizationId);
    }

    private long countOutcome(String outcome) {
        Long count = jdbcTemplate.queryForObject(
                "select count(*) from tmp_import_rows where outcome = ?", Long.class, outcome);
        return count == null ? 0L : count;
    }

    private List<ImportErrorSample> loadDatabaseErrors(int limit) {
        if (limit <= 0) {
            return List.of();
        }
        return jdbcTemplate.query("""
                        select row_number, error
                          from tmp_import_rows
                         where outcome = 'FAILED' and error is not null
                         order by row_number
                         limit ?
                        """,
                (rs, rowNum) -> new ImportErrorSample(rs.getLong("row_number"), rs.getString("error")),
                limit);
    }

    private void storeErrors(UUID organizationId, UUID importId, List<ImportErrorSample> errors) {
        if (errors.isEmpty()) {
            return;
        }
        jdbcTemplate.batchUpdate("""
                        insert into contact_import_errors
                          (import_id, organization_id, row_number, message)
                        values (?, ?, ?, ?)
                        """,
                errors, errors.size(), (statement, error) -> {
                    statement.setObject(1, importId);
                    statement.setObject(2, organizationId);
                    if (error.rowNumber() == null) {
                        statement.setNull(3, Types.BIGINT);
                    } else {
                        statement.setLong(3, error.rowNumber());
                    }
                    statement.setString(4, truncate(error.message(), 1000));
                });
    }

    private void updateProgress(UUID organizationId, UUID importId, UUID lockToken,
                                long processed, long created, long updated, long skipped,
                                long failed, long errors, long totalRows, long nextOffset) {
        int changed = jdbcTemplate.update("""
                update contact_imports
                   set processed_rows = processed_rows + ?,
                       created_count = created_count + ?,
                       updated_count = updated_count + ?,
                       skipped_count = skipped_count + ?,
                       failed_count = failed_count + ?,
                       error_count = error_count + ?,
                       total_rows = greatest(total_rows, ?),
                       resume_char_offset = ?,
                       locked_until = ?,
                       updated_at = now()
                 where id = ?
                   and organization_id = ?
                   and lock_token = ?
                   and status in ('QUEUED','RUNNING')
                """, processed, created, updated, skipped, failed, errors, totalRows, nextOffset,
                java.sql.Timestamp.from(Instant.now().plusSeconds(120)),
                importId, organizationId, lockToken);
        if (changed == 0) {
            throw new IllegalStateException("The import lock was lost before the batch could commit");
        }
    }

    private String identityKey(ContactImportRowParser.ParsedRow row) {
        if (row.email() != null) {
            return "email:" + row.email().toLowerCase(Locale.ROOT);
        }
        if (row.phone() != null) {
            return "phone:" + row.phone();
        }
        return null;
    }

    private String joinedTags(List<String> jobTags, List<String> rowTags) {
        Set<String> seen = new HashSet<>();
        List<String> tags = new ArrayList<>();
        appendTags(tags, seen, jobTags);
        appendTags(tags, seen, rowTags);
        return String.join(TAG_SEPARATOR, tags);
    }

    private void appendTags(List<String> target, Set<String> seen, List<String> source) {
        if (source == null) {
            return;
        }
        for (String raw : source) {
            if (raw == null) {
                continue;
            }
            String value = raw.replace(TAG_SEPARATOR, "").trim();
            if (value.isEmpty() || value.length() > 80) {
                continue;
            }
            if (seen.add(value.toLowerCase(Locale.ROOT))) {
                target.add(value);
            }
            if (target.size() >= 100) {
                return;
            }
        }
    }

    private String json(Map<String, Object> attributes) {
        try {
            return objectMapper.writeValueAsString(attributes == null ? Map.of() : new LinkedHashMap<>(attributes));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialise contact attributes", ex);
        }
    }

    private void setNullable(PreparedStatement statement, int index, String value) throws SQLException {
        if (value == null) {
            statement.setNull(index, Types.VARCHAR);
        } else {
            statement.setString(index, value);
        }
    }

    private String truncate(String value, int max) {
        if (value == null) {
            return "";
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    public record ImportErrorSample(Long rowNumber, String message) {
    }

    public record BatchResult(
            long processed,
            long created,
            long updated,
            long skipped,
            long failed,
            long errors,
            long nextOffset
    ) {
    }
}
