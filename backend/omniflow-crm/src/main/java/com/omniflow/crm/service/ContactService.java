package com.omniflow.crm.service;

import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.exception.BadRequestException;
import com.omniflow.common.exception.ConflictException;
import com.omniflow.common.exception.NotFoundException;
import com.omniflow.common.outbox.OutboxWriter;
import com.omniflow.common.util.PageMapper;
import com.omniflow.crm.domain.Contact;
import com.omniflow.crm.domain.ContactActivity;
import com.omniflow.crm.domain.ContactAttribute;
import com.omniflow.crm.domain.Tag;
import com.omniflow.crm.dto.ActivityView;
import com.omniflow.crm.dto.ContactAttributeView;
import com.omniflow.crm.dto.ContactView;
import com.omniflow.crm.dto.CreateAttributeRequest;
import com.omniflow.crm.dto.CreateTagRequest;
import com.omniflow.crm.dto.ImportJsonRequest;
import com.omniflow.crm.dto.ImportResult;
import com.omniflow.crm.dto.JsonContactRow;
import com.omniflow.crm.dto.TagView;
import com.omniflow.crm.dto.UpsertContactRequest;
import com.omniflow.crm.repository.ContactActivityRepository;
import com.omniflow.crm.repository.ContactAttributeRepository;
import com.omniflow.crm.repository.ContactRepository;
import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ContactService {

    private static final int MAX_IMPORT_ROWS = 20_000;
    private static final int MAX_IMPORT_ERRORS = 50;
    private static final Set<String> CONTACT_STATUSES =
            Set.of("ACTIVE", "UNSUBSCRIBED", "BOUNCED", "DELETED");
    private static final Set<String> ATTRIBUTE_DATA_TYPES =
            Set.of("STRING", "NUMBER", "BOOLEAN", "DATE", "URL");
    private static final String DEFAULT_SOURCE = "MANUAL";
    private static final String IMPORT_SOURCE = "IMPORT";

    private final ContactRepository contactRepository;
    private final ContactActivityRepository activityRepository;
    private final ContactAttributeRepository attributeRepository;
    private final TagService tagService;
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final OutboxWriter outboxWriter;

    // ------------------------------------------------------------------
    // Contacts
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public PageResponse<ContactView> list(UUID organizationId,
                                          PageQuery pageQuery,
                                          String q,
                                          UUID tagId,
                                          String status) {
        Pageable pageable = pageQuery.toPageRequest(Sort.by(Sort.Direction.DESC, "createdAt"));
        String normalizedQ = trimToNull(q);
        String normalizedStatus = normalizeStatusFilter(status);

        Page<Contact> page;
        if (tagId != null) {
            tagService.requireTag(organizationId, tagId);
            List<UUID> contactIds = jdbcTemplate.queryForList(
                    "select contact_id from contact_tags where tag_id = :tagId",
                    Map.of("tagId", tagId), UUID.class);
            if (contactIds.isEmpty()) {
                return PageResponse.empty(pageQuery.page(), pageQuery.size());
            }
            page = contactRepository.searchByIds(organizationId, contactIds, normalizedQ, normalizedStatus, pageable);
        } else {
            page = contactRepository.search(organizationId, normalizedQ, normalizedStatus, pageable);
        }

        Map<UUID, List<TagView>> tags = loadTags(organizationId,
                page.getContent().stream().map(Contact::getId).toList());
        List<ContactView> items = page.getContent().stream()
                .map(contact -> toView(contact, tags.getOrDefault(contact.getId(), List.of())))
                .toList();
        return PageResponse.of(items, page.getNumber(), page.getSize(), page.getTotalElements());
    }

    @Transactional(readOnly = true)
    public ContactView get(UUID organizationId, UUID id) {
        Contact contact = requireContact(organizationId, id);
        List<TagView> tags = loadTags(organizationId, List.of(id)).getOrDefault(id, List.of());
        List<ActivityView> recentActivities = activityRepository
                .findByContactIdAndOrganizationIdOrderByOccurredAtDesc(id, organizationId, PageRequest.of(0, 20))
                .getContent().stream()
                .map(this::toActivityView)
                .toList();
        return toView(contact, tags, recentActivities);
    }

    @Transactional
    public ContactView create(UUID organizationId, UUID actorId, UpsertContactRequest request) {
        String email = normalizeEmail(request.email());
        String phone = normalizePhone(request.phone());
        requireIdentity(email, phone);

        ensureContactUniqueness(organizationId, email, phone, null);

        Contact saved = persistNewContact(organizationId, actorId,
                email, phone,
                trimToNull(request.firstName()), trimToNull(request.lastName()),
                defaultStatus(request.status()),
                sourceOrDefault(request.source()),
                copyAttributes(request.attributes()),
                request.tags());
        return toView(saved, loadTags(organizationId, List.of(saved.getId()))
                .getOrDefault(saved.getId(), List.of()));
    }

    @Transactional
    public ContactView update(UUID organizationId, UUID id, UpsertContactRequest request) {
        Contact contact = requireContact(organizationId, id);

        String email = contact.getEmail();
        String phone = contact.getPhone();
        if (request.email() != null) {
            email = normalizeEmail(request.email());
        }
        if (request.phone() != null) {
            phone = normalizePhone(request.phone());
        }
        requireIdentity(email, phone);
        ensureContactUniqueness(organizationId, email, phone, id);

        contact.setEmail(email);
        contact.setPhone(phone);
        if (request.firstName() != null) {
            contact.setFirstName(trimToNull(request.firstName()));
        }
        if (request.lastName() != null) {
            contact.setLastName(trimToNull(request.lastName()));
        }
        if (request.status() != null) {
            contact.setStatus(validateStatus(request.status()));
        }
        if (request.source() != null) {
            String source = trimToNull(request.source());
            if (source != null) {
                contact.setSource(source);
            }
        }
        if (request.attributes() != null) {
            contact.setAttributes(copyAttributes(request.attributes()));
        }

        Contact saved = contactRepository.save(contact);
        if (request.tags() != null) {
            syncTagsByName(organizationId, saved.getId(), request.tags());
        }
        recordActivity(organizationId, saved.getId(), "CONTACT_UPDATED", null, new LinkedHashMap<>());
        return toView(saved, loadTags(organizationId, List.of(saved.getId()))
                .getOrDefault(saved.getId(), List.of()));
    }

    @Transactional
    public void delete(UUID organizationId, UUID id) {
        Contact contact = requireContact(organizationId, id);
        contact.setDeletedAt(Instant.now());
        contact.setStatus("DELETED");
        contactRepository.save(contact);
    }

    // ------------------------------------------------------------------
    // Tags on contacts
    // ------------------------------------------------------------------

    @Transactional
    public void addTag(UUID organizationId, UUID contactId, UUID tagId) {
        requireContact(organizationId, contactId);
        Tag tag = tagService.requireTag(organizationId, tagId);
        jdbcTemplate.update("""
                insert into contact_tags (contact_id, tag_id)
                values (:contactId, :tagId)
                on conflict do nothing
                """, Map.of("contactId", contactId, "tagId", tagId));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tagId", tagId);
        payload.put("tagName", tag.getName());
        recordActivity(organizationId, contactId, "TAG_ADDED", null, payload);
    }

    @Transactional
    public void removeTag(UUID organizationId, UUID contactId, UUID tagId) {
        requireContact(organizationId, contactId);
        Tag tag = tagService.requireTag(organizationId, tagId);
        jdbcTemplate.update("delete from contact_tags where contact_id = :contactId and tag_id = :tagId",
                Map.of("contactId", contactId, "tagId", tagId));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tagId", tagId);
        payload.put("tagName", tag.getName());
        recordActivity(organizationId, contactId, "TAG_REMOVED", null, payload);
    }

    @Transactional(readOnly = true)
    public List<TagView> getTags(UUID organizationId) {
        return tagService.list(organizationId);
    }

    @Transactional
    public TagView createTag(UUID organizationId, CreateTagRequest request) {
        return tagService.create(organizationId, request);
    }

    @Transactional
    public TagView updateTag(UUID organizationId, UUID id, CreateTagRequest request) {
        return tagService.update(organizationId, id, request);
    }

    @Transactional
    public void deleteTag(UUID organizationId, UUID id) {
        tagService.delete(organizationId, id);
    }

    // ------------------------------------------------------------------
    // Activities
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public PageResponse<ActivityView> activities(UUID organizationId, UUID contactId, PageQuery pageQuery) {
        requireContact(organizationId, contactId);
        Page<ContactActivity> page = activityRepository
                .findByContactIdAndOrganizationIdOrderByOccurredAtDesc(
                        contactId, organizationId, pageQuery.toPageRequest());
        return PageMapper.of(page, this::toActivityView);
    }

    // ------------------------------------------------------------------
    // Custom attribute definitions
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<ContactAttributeView> listAttributes(UUID organizationId) {
        return attributeRepository.findByOrganizationIdOrderByAttributeKeyAsc(organizationId).stream()
                .map(this::toAttributeView)
                .toList();
    }

    @Transactional
    public ContactAttributeView createAttribute(UUID organizationId, CreateAttributeRequest request) {
        String key = request.key() == null ? "" : request.key().trim();
        if (key.isEmpty()) {
            throw new BadRequestException("ATTRIBUTE_KEY_REQUIRED", "Attribute key is required");
        }
        if (attributeRepository.existsByOrganizationIdAndAttributeKeyIgnoreCase(organizationId, key)) {
            throw new ConflictException("ATTRIBUTE_EXISTS", "An attribute with this key already exists");
        }
        ContactAttribute attribute = new ContactAttribute();
        attribute.setOrganizationId(organizationId);
        attribute.setAttributeKey(key);
        attribute.setLabel(trimToNull(request.label()));
        attribute.setDataType(normalizeDataType(request.dataType()));
        return toAttributeView(attributeRepository.save(attribute));
    }

    // ------------------------------------------------------------------
    // Import / export
    // ------------------------------------------------------------------

    @Transactional
    public ImportResult importCsv(UUID organizationId, UUID actorId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("IMPORT_EMPTY", "A CSV file is required");
        }
        CSVFormat format = CSVFormat.DEFAULT.builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreHeaderCase(true)
                .setTrim(true)
                .setIgnoreEmptyLines(true)
                .build();

        ImportAccumulator accumulator = new ImportAccumulator();
        try (Reader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
             CSVParser parser = format.parse(reader)) {
            Map<String, Integer> headers = parser.getHeaderMap();
            Map<String, Integer> headerIndex = new HashMap<>();
            if (headers != null) {
                headers.forEach((name, index) -> {
                    if (name != null) {
                        headerIndex.put(name.toLowerCase(Locale.ROOT), index);
                    }
                });
            }
            if (!headerIndex.containsKey("email") && !headerIndex.containsKey("phone")) {
                throw new BadRequestException("INVALID_IMPORT", "CSV must contain an email or phone column");
            }
            for (CSVRecord record : parser) {
                if (accumulator.rows >= MAX_IMPORT_ROWS) {
                    throw new BadRequestException("IMPORT_LIMIT_EXCEEDED",
                            "At most " + MAX_IMPORT_ROWS + " rows can be imported at once");
                }
                accumulator.rows++;
                processImportRow(organizationId, actorId, accumulator,
                        csvValue(record, headerIndex, "email"),
                        csvValue(record, headerIndex, "phone"),
                        csvValue(record, headerIndex, "first_name"),
                        csvValue(record, headerIndex, "last_name"),
                        splitTags(csvValue(record, headerIndex, "tags")),
                        Map.of(),
                        record.getRecordNumber());
            }
        } catch (IOException ex) {
            throw new BadRequestException("IMPORT_FAILED", "Unable to read the CSV file");
        }
        return accumulator.toResult();
    }

    @Transactional
    public ImportResult importJson(UUID organizationId, UUID actorId, ImportJsonRequest request) {
        if (request == null || request.contacts() == null) {
            throw new BadRequestException("IMPORT_EMPTY", "contacts is required");
        }
        if (request.contacts().size() > MAX_IMPORT_ROWS) {
            throw new BadRequestException("IMPORT_LIMIT_EXCEEDED",
                    "At most " + MAX_IMPORT_ROWS + " rows can be imported at once");
        }
        ImportAccumulator accumulator = new ImportAccumulator();
        long rowNumber = 0;
        for (JsonContactRow row : request.contacts()) {
            rowNumber++;
            accumulator.rows++;
            if (row == null) {
                accumulator.skipped++;
                accumulator.addError("Row " + rowNumber + ": empty row");
                continue;
            }
            processImportRow(organizationId, actorId, accumulator,
                    row.email(), row.phone(), row.firstName(), row.lastName(),
                    row.tags(), row.attributes(), rowNumber);
        }
        return accumulator.toResult();
    }

    @Transactional(readOnly = true)
    public String exportCsv(UUID organizationId) {
        List<Contact> contacts =
                contactRepository.findByOrganizationIdAndDeletedAtIsNullOrderByCreatedAtDesc(organizationId);
        Map<UUID, List<TagView>> tags = loadTags(organizationId,
                contacts.stream().map(Contact::getId).toList());

        try (StringWriter writer = new StringWriter();
             CSVPrinter printer = new CSVPrinter(writer, CSVFormat.DEFAULT.builder()
                     .setHeader("email", "phone", "first_name", "last_name",
                             "status", "source", "created_at", "tags")
                     .build())) {
            for (Contact contact : contacts) {
                String tagNames = tags.getOrDefault(contact.getId(), List.of()).stream()
                        .map(TagView::name)
                        .collect(Collectors.joining(";"));
                printer.printRecord(
                        contact.getEmail(),
                        contact.getPhone(),
                        contact.getFirstName(),
                        contact.getLastName(),
                        contact.getStatus(),
                        contact.getSource(),
                        contact.getCreatedAt() == null ? null : contact.getCreatedAt().toString(),
                        tagNames);
            }
            printer.flush();
            return writer.toString();
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to build contacts CSV export", ex);
        }
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    private void processImportRow(UUID organizationId,
                                  UUID actorId,
                                  ImportAccumulator accumulator,
                                  String rawEmail,
                                  String rawPhone,
                                  String firstName,
                                  String lastName,
                                  List<String> tags,
                                  Map<String, Object> attributes,
                                  long rowNumber) {
        String email = normalizeEmail(rawEmail);
        String phone = normalizePhone(rawPhone);
        if (email == null && phone == null) {
            accumulator.skipped++;
            accumulator.addError("Row " + rowNumber + ": email or phone is required");
            return;
        }
        try {
            boolean created = upsertImportedContact(organizationId, actorId, email, phone,
                    trimToNull(firstName), trimToNull(lastName), tags, attributes);
            if (created) {
                accumulator.created++;
            } else {
                accumulator.updated++;
            }
        } catch (RuntimeException ex) {
            accumulator.skipped++;
            accumulator.addError("Row " + rowNumber + ": " + safeMessage(ex));
        }
    }

    private boolean upsertImportedContact(UUID organizationId,
                                          UUID actorId,
                                          String email,
                                          String phone,
                                          String firstName,
                                          String lastName,
                                          List<String> tags,
                                          Map<String, Object> attributes) {
        Contact existing = null;
        if (email != null) {
            existing = contactRepository
                    .findByOrganizationIdAndEmailIgnoreCaseAndDeletedAtIsNull(organizationId, email)
                    .orElse(null);
        }
        if (existing == null && phone != null) {
            existing = contactRepository
                    .findByOrganizationIdAndPhoneAndDeletedAtIsNull(organizationId, phone)
                    .orElse(null);
        }
        if (existing == null) {
            persistNewContact(organizationId, actorId, email, phone, firstName, lastName,
                    "ACTIVE", IMPORT_SOURCE, copyAttributes(attributes), tags);
            return true;
        }

        boolean changed = false;
        if (firstName != null && !firstName.equals(existing.getFirstName())) {
            existing.setFirstName(firstName);
            changed = true;
        }
        if (lastName != null && !lastName.equals(existing.getLastName())) {
            existing.setLastName(lastName);
            changed = true;
        }
        if (email != null && !email.equalsIgnoreCase(existing.getEmail() == null ? "" : existing.getEmail())) {
            existing.setEmail(email);
            changed = true;
        }
        if (phone != null && !phone.equals(existing.getPhone())) {
            existing.setPhone(phone);
            changed = true;
        }
        if (attributes != null && !attributes.isEmpty()) {
            Map<String, Object> merged = new HashMap<>(
                    existing.getAttributes() == null ? Map.of() : existing.getAttributes());
            merged.putAll(attributes);
            existing.setAttributes(merged);
            changed = true;
        }
        if (changed) {
            contactRepository.save(existing);
        }
        if (tags != null) {
            appendTagsByName(organizationId, existing.getId(), tags);
        }
        return false;
    }

    private Contact persistNewContact(UUID organizationId,
                                      UUID actorId,
                                      String email,
                                      String phone,
                                      String firstName,
                                      String lastName,
                                      String status,
                                      String source,
                                      Map<String, Object> attributes,
                                      List<String> tags) {
        Contact contact = new Contact();
        contact.setOrganizationId(organizationId);
        contact.setEmail(email);
        contact.setPhone(phone);
        contact.setFirstName(firstName);
        contact.setLastName(lastName);
        contact.setStatus(status == null ? "ACTIVE" : status);
        contact.setSource(source == null ? DEFAULT_SOURCE : source);
        contact.setAttributes(copyAttributes(attributes));
        Contact saved = contactRepository.saveAndFlush(contact);

        if (tags != null) {
            syncTagsByName(organizationId, saved.getId(), tags);
        }
        publishContactCreated(saved);

        Map<String, Object> payload = new LinkedHashMap<>();
        if (actorId != null) {
            payload.put("actorId", actorId);
        }
        recordActivity(organizationId, saved.getId(), "CONTACT_CREATED", null, payload);
        return saved;
    }

    private void publishContactCreated(Contact contact) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("contactId", contact.getId());
        payload.put("organizationId", contact.getOrganizationId());
        payload.put("email", contact.getEmail());
        payload.put("phone", contact.getPhone());
        payload.put("firstName", contact.getFirstName());
        payload.put("lastName", contact.getLastName());
        outboxWriter.write("contact", contact.getId(), "contact.created", contact.getOrganizationId(), payload);
    }

    private List<Tag> syncTagsByName(UUID organizationId, UUID contactId, List<String> tagNames) {
        jdbcTemplate.update("delete from contact_tags where contact_id = :contactId",
                Map.of("contactId", contactId));
        return appendTagsByName(organizationId, contactId, tagNames);
    }

    private List<Tag> appendTagsByName(UUID organizationId, UUID contactId, List<String> tagNames) {
        List<Tag> tags = new ArrayList<>();
        if (tagNames == null || tagNames.isEmpty()) {
            return tags;
        }
        Set<String> seen = new HashSet<>();
        for (String raw : tagNames) {
            if (raw == null) {
                continue;
            }
            String name = raw.trim();
            if (name.isEmpty() || !seen.add(name.toLowerCase(Locale.ROOT))) {
                continue;
            }
            Tag tag = tagService.findOrCreate(organizationId, name);
            jdbcTemplate.update("""
                    insert into contact_tags (contact_id, tag_id)
                    values (:contactId, :tagId)
                    on conflict do nothing
                    """, Map.of("contactId", contactId, "tagId", tag.getId()));
            tags.add(tag);
        }
        return tags;
    }

    private Map<UUID, List<TagView>> loadTags(UUID organizationId, Collection<UUID> contactIds) {
        if (contactIds == null || contactIds.isEmpty()) {
            return Map.of();
        }
        String sql = """
                select ct.contact_id as contact_id,
                       t.id          as tag_id,
                       t.name        as tag_name,
                       t.color       as tag_color,
                       (select count(*) from contact_tags x where x.tag_id = t.id) as contact_count
                from contact_tags ct
                join tags t on t.id = ct.tag_id
                where ct.contact_id in (:ids)
                  and t.organization_id = :orgId
                order by lower(t.name)
                """;
        List<TagRow> rows = jdbcTemplate.query(sql, Map.of("ids", contactIds, "orgId", organizationId),
                (rs, rowNum) -> new TagRow(
                        rs.getObject("contact_id", UUID.class),
                        new TagView(
                                rs.getObject("tag_id", UUID.class),
                                rs.getString("tag_name"),
                                rs.getString("tag_color"),
                                rs.getLong("contact_count"))));
        Map<UUID, List<TagView>> result = new HashMap<>();
        for (TagRow row : rows) {
            result.computeIfAbsent(row.contactId(), key -> new ArrayList<>()).add(row.tag());
        }
        return result;
    }

    private void recordActivity(UUID organizationId,
                                UUID contactId,
                                String type,
                                Channel channel,
                                Map<String, Object> payload) {
        ContactActivity activity = new ContactActivity();
        activity.setOrganizationId(organizationId);
        activity.setContactId(contactId);
        activity.setType(type);
        activity.setChannel(channel);
        activity.setPayload(payload == null ? new LinkedHashMap<>() : new LinkedHashMap<>(payload));
        activity.setOccurredAt(Instant.now());
        activityRepository.save(activity);
    }

    private Contact requireContact(UUID organizationId, UUID id) {
        return contactRepository.findByIdAndOrganizationIdAndDeletedAtIsNull(id, organizationId)
                .orElseThrow(() -> new NotFoundException("Contact", id));
    }

    private void ensureContactUniqueness(UUID organizationId, String email, String phone, UUID excludeId) {
        if (email != null) {
            contactRepository.findByOrganizationIdAndEmailIgnoreCaseAndDeletedAtIsNull(organizationId, email)
                    .filter(existing -> excludeId == null || !existing.getId().equals(excludeId))
                    .ifPresent(existing -> {
                        throw new ConflictException("CONTACT_EXISTS",
                                "A contact with this email already exists");
                    });
        }
        if (phone != null) {
            contactRepository.findByOrganizationIdAndPhoneAndDeletedAtIsNull(organizationId, phone)
                    .filter(existing -> excludeId == null || !existing.getId().equals(excludeId))
                    .ifPresent(existing -> {
                        throw new ConflictException("CONTACT_EXISTS",
                                "A contact with this phone already exists");
                    });
        }
    }

    private void requireIdentity(String email, String phone) {
        if (email == null && phone == null) {
            throw new BadRequestException("CONTACT_IDENTITY_REQUIRED",
                    "At least one of email or phone is required");
        }
    }

    private String defaultStatus(String status) {
        if (status == null || status.isBlank()) {
            return "ACTIVE";
        }
        return validateStatus(status);
    }

    private String normalizeStatusFilter(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        return validateStatus(status);
    }

    private String validateStatus(String status) {
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!CONTACT_STATUSES.contains(normalized)) {
            throw new BadRequestException("INVALID_CONTACT_STATUS",
                    "Unsupported contact status: " + status);
        }
        return normalized;
    }

    private String sourceOrDefault(String source) {
        String normalized = trimToNull(source);
        return normalized == null ? DEFAULT_SOURCE : normalized;
    }

    private String normalizeEmail(String email) {
        String normalized = trimToNull(email);
        return normalized == null ? null : normalized.toLowerCase(Locale.ROOT);
    }

    private String normalizePhone(String phone) {
        return trimToNull(phone);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Map<String, Object> copyAttributes(Map<String, Object> attributes) {
        return attributes == null ? new LinkedHashMap<>() : new LinkedHashMap<>(attributes);
    }

    private String normalizeDataType(String dataType) {
        if (dataType == null || dataType.isBlank()) {
            return "STRING";
        }
        String normalized = dataType.trim().toUpperCase(Locale.ROOT);
        if (!ATTRIBUTE_DATA_TYPES.contains(normalized)) {
            throw new BadRequestException("INVALID_ATTRIBUTE_TYPE",
                    "Unsupported attribute data type: " + dataType);
        }
        return normalized;
    }

    private ContactView toView(Contact contact, List<TagView> tags) {
        return toView(contact, tags, List.of());
    }

    private ContactView toView(Contact contact, List<TagView> tags, List<ActivityView> recentActivities) {
        return new ContactView(
                contact.getId(),
                contact.getEmail(),
                contact.getPhone(),
                contact.getFirstName(),
                contact.getLastName(),
                contact.getStatus(),
                contact.getSource(),
                contact.getAttributes() == null ? Map.of() : new LinkedHashMap<>(contact.getAttributes()),
                tags,
                contact.getLastEngagementAt(),
                contact.getCreatedAt(),
                contact.getUpdatedAt(),
                recentActivities);
    }

    private ActivityView toActivityView(ContactActivity activity) {
        return new ActivityView(
                activity.getId(),
                activity.getType(),
                activity.getChannel(),
                activity.getPayload(),
                activity.getOccurredAt());
    }

    private ContactAttributeView toAttributeView(ContactAttribute attribute) {
        return new ContactAttributeView(
                attribute.getId(),
                attribute.getAttributeKey(),
                attribute.getLabel(),
                attribute.getDataType());
    }

    private List<String> splitTags(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        List<String> tags = new ArrayList<>();
        for (String part : value.split("[;|]")) {
            String tag = part.trim();
            if (!tag.isEmpty()) {
                tags.add(tag);
            }
        }
        return tags;
    }

    private String csvValue(CSVRecord record, Map<String, Integer> headerIndex, String column) {
        Integer index = headerIndex.get(column);
        if (index == null || index < 0 || index >= record.size()) {
            return null;
        }
        return record.get(index);
    }

    private String safeMessage(RuntimeException ex) {
        String message = ex.getMessage();
        return message == null || message.isBlank() ? ex.getClass().getSimpleName() : message;
    }

    private record TagRow(UUID contactId, TagView tag) {
    }

    private static final class ImportAccumulator {

        private int rows;
        private int created;
        private int updated;
        private int skipped;
        private final List<String> errors = new ArrayList<>();

        private void addError(String message) {
            if (errors.size() < MAX_IMPORT_ERRORS) {
                errors.add(message);
            }
        }

        private ImportResult toResult() {
            return new ImportResult(created, updated, skipped, errors);
        }
    }
}
