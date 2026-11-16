package com.omniflow.crm.service;

import com.omniflow.common.exception.BadRequestException;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Detects CSV headers and builds the canonical field mapping used by the
 * streaming import worker. Headers are normalised once and stored on the job so
 * the worker can resolve columns by position even when names repeat.
 */
@Component
public class ContactImportMappingResolver {

    public static final String EMAIL = "email";
    public static final String PHONE = "phone";
    public static final String FIRST_NAME = "firstName";
    public static final String LAST_NAME = "lastName";
    public static final String STATUS = "status";
    public static final String TAGS = "tags";
    public static final String EXTERNAL_ID = "externalId";

    private static final Map<String, List<String>> ALIASES = Map.of(
            EMAIL, List.of("email", "e-mail", "email address", "emailaddress", "mail", "work email"),
            PHONE, List.of("phone", "phone number", "phonenumber", "mobile", "mobile number",
                    "whatsapp", "whatsapp number", "sms", "telephone", "tel", "number", "cell"),
            FIRST_NAME, List.of("first name", "firstname", "first_name", "given name", "givenname", "fname"),
            LAST_NAME, List.of("last name", "lastname", "last_name", "surname", "family name", "lname"),
            STATUS, List.of("status", "contact status", "subscription status"),
            TAGS, List.of("tags", "tag", "labels", "label", "list", "lists"),
            EXTERNAL_ID, List.of("external id", "external_id", "externalid", "contact id", "contactid", "id")
    );

    private static final List<String> CANONICAL_FIELDS =
            List.of(EMAIL, PHONE, FIRST_NAME, LAST_NAME, STATUS, TAGS, EXTERNAL_ID);
    private static final Set<String> CANONICAL_FIELD_SET = Set.copyOf(CANONICAL_FIELDS);

    public DetectedFormat detect(byte[] prefix) {
        if (prefix == null || prefix.length == 0) {
            throw new BadRequestException("IMPORT_HEADER_MISSING", "The uploaded file is empty");
        }
        String text = new String(prefix, StandardCharsets.UTF_8);
        if (!text.isEmpty() && text.charAt(0) == '\uFEFF') {
            text = text.substring(1);
        }
        String firstLine = firstLine(text);
        char delimiter = detectDelimiter(firstLine);
        List<String> headers = parseHeaders(text, delimiter);
        return new DetectedFormat(String.valueOf(delimiter), headers);
    }

    public Map<String, String> autoMap(List<String> headers) {
        Map<String, String> mapping = new LinkedHashMap<>();
        Set<String> used = new LinkedHashSet<>();
        for (String canonical : CANONICAL_FIELDS) {
            List<String> aliases = ALIASES.get(canonical);
            for (String header : headers) {
                String normalized = normalizeHeader(header);
                if (!used.contains(header) && aliases.contains(normalized)) {
                    mapping.put(canonical, header);
                    used.add(header);
                    break;
                }
            }
        }
        return mapping;
    }

    public Map<String, String> autoAttributeMapping(List<String> headers, Map<String, String> mapping) {
        Set<String> mappedHeaders = new LinkedHashSet<>(mapping.values());
        Map<String, String> attributes = new LinkedHashMap<>();
        Set<String> usedKeys = new LinkedHashSet<>();
        for (String header : headers) {
            if (mappedHeaders.contains(header)) {
                continue;
            }
            String key = slug(header);
            String candidate = key;
            int suffix = 2;
            while (usedKeys.contains(candidate)) {
                candidate = key + "_" + suffix++;
            }
            usedKeys.add(candidate);
            attributes.put(header, candidate);
        }
        return attributes;
    }

    public Map<String, String> validateMapping(List<String> headers,
                                               Map<String, String> requested) {
        Map<String, String> mapping = new LinkedHashMap<>();
        Map<String, String> source = requested == null || requested.isEmpty() ? autoMap(headers) : requested;
        for (Map.Entry<String, String> entry : source.entrySet()) {
            String canonical = entry.getKey();
            String header = entry.getValue();
            if (canonical == null || !CANONICAL_FIELD_SET.contains(canonical)) {
                throw new BadRequestException("INVALID_IMPORT_MAPPING",
                        "Unknown contact field: " + canonical);
            }
            if (header == null || header.isBlank()) {
                continue;
            }
            if (!headers.contains(header)) {
                throw new BadRequestException("INVALID_IMPORT_MAPPING",
                        "The CSV does not contain the column \"" + header + "\"");
            }
            mapping.put(canonical, header);
        }
        if (!mapping.containsKey(EMAIL) && !mapping.containsKey(PHONE)) {
            throw new BadRequestException("INVALID_IMPORT_MAPPING",
                    "Map at least an email column or a phone column");
        }
        return mapping;
    }

    public Map<String, String> validateAttributeMapping(List<String> headers,
                                                        Map<String, String> mapping,
                                                        Map<String, String> requested) {
        if (requested == null) {
            return autoAttributeMapping(headers, mapping);
        }
        Map<String, String> result = new LinkedHashMap<>();
        Set<String> usedKeys = new LinkedHashSet<>();
        for (Map.Entry<String, String> entry : requested.entrySet()) {
            String header = entry.getKey();
            String key = slug(entry.getValue());
            if (header == null || key.isEmpty()) {
                continue;
            }
            if (!headers.contains(header)) {
                throw new BadRequestException("INVALID_IMPORT_MAPPING",
                        "The CSV does not contain the column \"" + header + "\"");
            }
            if (mapping.containsValue(header)) {
                continue;
            }
            String candidate = key;
            int suffix = 2;
            while (usedKeys.contains(candidate)) {
                candidate = key + "_" + suffix++;
            }
            usedKeys.add(candidate);
            result.put(header, candidate);
        }
        return result;
    }

    public List<String> sanitizeTags(List<String> tags) {
        if (tags == null) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (String raw : tags) {
            if (raw == null) {
                continue;
            }
            String tag = raw.trim();
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

    /**
     * Applies the same normalisation to the worker's first CSV record that the
     * header detector applies to the upload prefix. Column positions are stable,
     * so the stored mapping still resolves after a restart.
     */
    public List<String> normalizeHeaders(List<String> rawHeaders) {
        List<String> normalized = new ArrayList<>();
        Set<String> used = new LinkedHashSet<>();
        int position = 1;
        if (rawHeaders != null) {
            for (String raw : rawHeaders) {
                String name = raw == null ? "" : raw.trim();
                if (name.isEmpty()) {
                    name = "Column " + position;
                }
                String candidate = name;
                int suffix = 2;
                while (used.contains(candidate.toLowerCase(Locale.ROOT))) {
                    candidate = name + " (" + suffix++ + ")";
                }
                used.add(candidate.toLowerCase(Locale.ROOT));
                normalized.add(candidate);
                position++;
            }
        }
        if (normalized.isEmpty()) {
            throw new BadRequestException("IMPORT_HEADER_MISSING",
                    "The CSV does not contain a header row");
        }
        return normalized;
    }

    private List<String> parseHeaders(String text, char delimiter) {
        try (CSVParser parser = CSVFormat.DEFAULT.builder()
                .setDelimiter(delimiter)
                .setTrim(true)
                .setIgnoreSurroundingSpaces(true)
                .setIgnoreEmptyLines(true)
                .build()
                .parse(new StringReader(text))) {
            if (!parser.iterator().hasNext()) {
                throw new BadRequestException("IMPORT_HEADER_MISSING",
                        "The CSV does not contain a header row");
            }
            CSVRecord header = parser.iterator().next();
            return normalizeHeaders(new ArrayList<>(header.toList()));
        } catch (BadRequestException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BadRequestException("IMPORT_HEADER_INVALID",
                    "Unable to parse the CSV header. Check the delimiter and quoting.");
        }
    }

    private String firstLine(String text) {
        int end = text.indexOf('\n');
        String line = end >= 0 ? text.substring(0, end) : text;
        if (line.endsWith("\r")) {
            line = line.substring(0, line.length() - 1);
        }
        return line;
    }

    private char detectDelimiter(String line) {
        char[] candidates = {',', ';', '\t', '|'};
        char best = ',';
        int bestCount = -1;
        for (char candidate : candidates) {
            int count = 0;
            boolean quoted = false;
            for (int i = 0; i < line.length(); i++) {
                char ch = line.charAt(i);
                if (ch == '"') {
                    quoted = !quoted;
                } else if (ch == candidate && !quoted) {
                    count++;
                }
            }
            if (count > bestCount) {
                best = candidate;
                bestCount = count;
            }
        }
        return best;
    }

    private String normalizeHeader(String header) {
        return header == null ? "" : header.trim().toLowerCase(Locale.ROOT)
                .replace('_', ' ')
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String slug(String value) {
        if (value == null) {
            return "";
        }
        String slug = value.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
        if (slug.isEmpty()) {
            slug = "attribute";
        }
        return slug.length() > 100 ? slug.substring(0, 100) : slug;
    }

    public record DetectedFormat(String delimiter, List<String> headers) {
    }
}
