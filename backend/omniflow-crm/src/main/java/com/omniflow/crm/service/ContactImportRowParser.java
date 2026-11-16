package com.omniflow.crm.service;

import com.omniflow.common.exception.BadRequestException;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Converts one CSV record into a validated contact row. Validation happens
 * before the batch reaches PostgreSQL so a malformed row cannot abort an entire
 * 5,000-row transaction.
 */
@Component
public class ContactImportRowParser {

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern PHONE_ALLOWED = Pattern.compile("[^0-9+]");
    private static final Pattern INTEGER = Pattern.compile("^-?\\d{1,18}$");
    private static final Pattern DECIMAL = Pattern.compile("^-?\\d{1,15}\\.\\d{1,8}$");
    private static final Set<String> CONTACT_STATUSES =
            Set.of("ACTIVE", "UNSUBSCRIBED", "BOUNCED", "DELETED");

    public ColumnLayout layout(List<String> headers,
                               Map<String, String> mapping,
                               Map<String, String> attributeMapping) {
        Map<String, Integer> indexes = new LinkedHashMap<>();
        for (int i = 0; i < headers.size(); i++) {
            indexes.put(headers.get(i), i);
        }
        Map<String, Integer> attributes = new LinkedHashMap<>();
        if (attributeMapping != null) {
            for (Map.Entry<String, String> entry : attributeMapping.entrySet()) {
                Integer index = indexes.get(entry.getKey());
                if (index == null) {
                    throw new BadRequestException("INVALID_IMPORT_MAPPING",
                            "The CSV does not contain the column \"" + entry.getKey() + "\"");
                }
                attributes.put(entry.getValue(), index);
            }
        }
        return new ColumnLayout(
                indexOf(indexes, mapping, ContactImportMappingResolver.EMAIL),
                indexOf(indexes, mapping, ContactImportMappingResolver.PHONE),
                indexOf(indexes, mapping, ContactImportMappingResolver.FIRST_NAME),
                indexOf(indexes, mapping, ContactImportMappingResolver.LAST_NAME),
                indexOf(indexes, mapping, ContactImportMappingResolver.STATUS),
                indexOf(indexes, mapping, ContactImportMappingResolver.TAGS),
                indexOf(indexes, mapping, ContactImportMappingResolver.EXTERNAL_ID),
                headers.size(),
                attributes);
    }

    public ParsedRow parse(CSVRecord record, ColumnLayout layout, long rowNumber) {
        return parse(record.toList(), layout, rowNumber);
    }

    public ParsedRow parse(List<String> values, ColumnLayout layout, long rowNumber) {
        String email = normalizeEmail(value(values, layout.email()));
        String phone = normalizePhone(value(values, layout.phone()));
        String firstName = limit(value(values, layout.firstName()), 255);
        String lastName = limit(value(values, layout.lastName()), 255);
        String externalId = limit(value(values, layout.externalId()), 500);
        String tagsValue = value(values, layout.tags());
        String statusValue = value(values, layout.status());

        if (email == null && phone == null) {
            return ParsedRow.error(rowNumber, "Row " + rowNumber + ": email or phone is required");
        }

        String status = null;
        if (!statusValue.isEmpty()) {
            status = normalizeStatus(statusValue);
            if (status == null) {
                return ParsedRow.error(rowNumber,
                        "Row " + rowNumber + ": unsupported status \"" + limit(statusValue, 40) + "\"");
            }
        }

        Map<String, Object> attributes = new LinkedHashMap<>();
        for (Map.Entry<String, Integer> entry : layout.attributes().entrySet()) {
            String raw = value(values, entry.getValue());
            if (!raw.isEmpty()) {
                attributes.put(entry.getKey(), inferValue(raw));
            }
        }

        return new ParsedRow(rowNumber, email, phone, firstName, lastName, status, externalId,
                attributes, splitTags(tagsValue), null);
    }

    public List<String> splitTags(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (String part : raw.split("[;|,]")) {
            String tag = part.trim();
            if (tag.isEmpty() || tag.length() > 80) {
                continue;
            }
            if (seen.add(tag.toLowerCase(Locale.ROOT))) {
                result.add(tag);
            }
            if (result.size() >= 50) {
                break;
            }
        }
        return result;
    }

    private Integer indexOf(Map<String, Integer> indexes,
                            Map<String, String> mapping,
                            String canonical) {
        if (mapping == null) {
            return -1;
        }
        String header = mapping.get(canonical);
        if (header == null) {
            return -1;
        }
        Integer index = indexes.get(header);
        if (index == null) {
            throw new BadRequestException("INVALID_IMPORT_MAPPING",
                    "The CSV does not contain the column \"" + header + "\"");
        }
        return index;
    }

    private String value(List<String> values, int index) {
        if (index < 0 || index >= values.size()) {
            return "";
        }
        String value = values.get(index);
        return value == null ? "" : value.trim();
    }

    static String normalizeEmail(String raw) {
        if (raw == null) {
            return null;
        }
        String email = raw.trim();
        if (email.isEmpty()) {
            return null;
        }
        if (email.regionMatches(true, 0, "mailto:", 0, 7)) {
            email = email.substring(7).trim();
        }
        email = email.toLowerCase(Locale.ROOT);
        if (email.length() > 320 || !EMAIL_PATTERN.matcher(email).matches()) {
            return null;
        }
        return email;
    }

    static String normalizePhone(String raw) {
        if (raw == null) {
            return null;
        }
        String phone = raw.trim();
        if (phone.isEmpty()) {
            return null;
        }
        if (phone.startsWith("00")) {
            phone = "+" + phone.substring(2);
        }
        phone = PHONE_ALLOWED.matcher(phone).replaceAll("");
        if (phone.startsWith("+")) {
            phone = "+" + phone.substring(1).replace("+", "");
        } else {
            phone = phone.replace("+", "");
        }
        long digits = phone.chars().filter(Character::isDigit).count();
        if (digits < 5 || digits > 17 || phone.length() > 40) {
            return null;
        }
        return phone;
    }

    private String normalizeStatus(String raw) {
        String value = raw.trim().toUpperCase(Locale.ROOT);
        return switch (value) {
            case "SUBSCRIBED", "OPT-IN", "OPT IN", "YES", "TRUE" -> "ACTIVE";
            case "UNSUBSCRIBE", "UNSUBSCRIBED", "OPT-OUT", "OPT OUT", "NO", "FALSE" -> "UNSUBSCRIBED";
            case "BOUNCE", "BOUNCED", "HARD_BOUNCE" -> "BOUNCED";
            case "DELETED", "REMOVED" -> "DELETED";
            default -> CONTACT_STATUSES.contains(value) ? value : null;
        };
    }

    private Object inferValue(String raw) {
        String value = limit(raw, 4000);
        if (INTEGER.matcher(value).matches()) {
            try {
                return Long.parseLong(value);
            } catch (NumberFormatException ignored) {
                return value;
            }
        }
        if (DECIMAL.matcher(value).matches()) {
            try {
                return Double.parseDouble(value);
            } catch (NumberFormatException ignored) {
                return value;
            }
        }
        if ("true".equalsIgnoreCase(value)) {
            return Boolean.TRUE;
        }
        if ("false".equalsIgnoreCase(value)) {
            return Boolean.FALSE;
        }
        return value;
    }

    private String limit(String value, int max) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.length() > max ? trimmed.substring(0, max) : trimmed;
    }

    public record ColumnLayout(
            int email,
            int phone,
            int firstName,
            int lastName,
            int status,
            int tags,
            int externalId,
            int headerColumnCount,
            Map<String, Integer> attributes
    ) {
    }

    public record ParsedRow(
            long rowNumber,
            String email,
            String phone,
            String firstName,
            String lastName,
            String status,
            String externalId,
            Map<String, Object> attributes,
            List<String> tags,
            String error
    ) {
        public static ParsedRow error(long rowNumber, String message) {
            return new ParsedRow(rowNumber, null, null, null, null, null, null,
                    Map.of(), List.of(), message);
        }

        public boolean valid() {
            return error == null;
        }
    }
}
