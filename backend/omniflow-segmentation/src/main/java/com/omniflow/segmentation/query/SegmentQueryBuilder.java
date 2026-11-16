package com.omniflow.segmentation.query;

import com.fasterxml.jackson.databind.JsonNode;
import com.omniflow.common.exception.BadRequestException;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Compiles the JSON rule array stored on a segment into a parameterised SQL predicate.
 * Column names are only ever taken from the whitelist below; every rule value is bound
 * through a named parameter.
 */
@Component
public class SegmentQueryBuilder {

    public record Compiled(String predicate, Map<String, Object> parameters) {
    }

    private static final Map<String, String> SIMPLE_FIELDS = Map.ofEntries(
            Map.entry("email", "c.email"),
            Map.entry("phone", "c.phone"),
            Map.entry("first_name", "c.first_name"),
            Map.entry("last_name", "c.last_name"),
            Map.entry("status", "c.status"),
            Map.entry("source", "c.source"),
            Map.entry("created_at", "c.created_at"),
            Map.entry("last_engagement_at", "c.last_engagement_at"));

    private static final Set<String> OPERATORS = Set.of(
            "eq", "neq", "contains", "starts_with", "ends_with",
            "gt", "gte", "lt", "lte", "in", "exists", "not_exists");

    private static final Pattern ATTRIBUTE_KEY = Pattern.compile("[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}");

    public Compiled compile(UUID organizationId, JsonNode rules, String matchType) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("orgId", organizationId);

        if (rules == null || rules.isNull() || !rules.isArray() || rules.isEmpty()) {
            return new Compiled("1 = 1", parameters);
        }

        List<String> predicates = new ArrayList<>();
        int index = 0;
        for (JsonNode rule : rules) {
            if (rule == null || !rule.isObject()) {
                throw new BadRequestException("INVALID_SEGMENT_RULE", "Each segment rule must be an object");
            }
            String field = text(rule.get("field"));
            String operator = text(rule.get("operator"));
            JsonNode value = rule.get("value");
            String parameter = "p" + index++;
            predicates.add("(" + compileRule(field, operator, value, parameter, parameters) + ")");
        }

        String joiner = "ANY".equalsIgnoreCase(matchType) ? " or " : " and ";
        return new Compiled(String.join(joiner, predicates), parameters);
    }

    private String compileRule(String field,
                               String operator,
                               JsonNode value,
                               String parameter,
                               Map<String, Object> parameters) {
        if (field == null || field.isBlank()) {
            throw new BadRequestException("INVALID_SEGMENT_RULE", "Rule field is required");
        }
        String op = operator == null ? "" : operator.trim().toLowerCase(Locale.ROOT);
        if (!OPERATORS.contains(op)) {
            throw new BadRequestException("INVALID_SEGMENT_OPERATOR",
                    "Unsupported segment operator: " + operator);
        }

        if ("tag".equals(field)) {
            return compileTagRule(op, value, parameter, parameters);
        }

        boolean timestamp = "created_at".equals(field) || "last_engagement_at".equals(field);
        String column;
        if (field.startsWith("attribute.")) {
            String key = field.substring("attribute.".length());
            if (!ATTRIBUTE_KEY.matcher(key).matches()) {
                throw new BadRequestException("INVALID_SEGMENT_FIELD",
                        "Unsupported attribute key: " + key);
            }
            column = "c.attributes->>'" + key.replace("'", "''") + "'";
        } else if (SIMPLE_FIELDS.containsKey(field)) {
            column = SIMPLE_FIELDS.get(field);
        } else {
            throw new BadRequestException("INVALID_SEGMENT_FIELD",
                    "Unsupported segment field: " + field);
        }

        return compare(op, column, value, parameter, parameters, timestamp);
    }

    private String compare(String op,
                           String column,
                           JsonNode value,
                           String parameter,
                           Map<String, Object> parameters,
                           boolean timestamp) {
        switch (op) {
            case "exists":
                return column + " is not null";
            case "not_exists":
                return column + " is null";
            case "in": {
                List<String> values = textValues(value);
                if (values.isEmpty()) {
                    throw new BadRequestException("INVALID_SEGMENT_RULE",
                            "The in operator requires a non-empty array value");
                }
                parameters.put(parameter, values);
                return (timestamp ? "cast(" + column + " as text)" : column) + " in (:" + parameter + ")";
            }
            case "eq":
            case "neq": {
                if (value == null || value.isNull()) {
                    return "eq".equals(op) ? column + " is null" : column + " is not null";
                }
                parameters.put(parameter, textValue(value));
                String sqlOperator = "eq".equals(op) ? "=" : "<>";
                return timestamp
                        ? column + " " + sqlOperator + " cast(:" + parameter + " as timestamptz)"
                        : column + " " + sqlOperator + " :" + parameter;
            }
            case "contains": {
                parameters.put(parameter, textValue(value));
                String expression = timestamp ? "cast(" + column + " as text)" : column;
                return expression + " ilike ('%' || :" + parameter + " || '%')";
            }
            case "starts_with": {
                parameters.put(parameter, textValue(value));
                String expression = timestamp ? "cast(" + column + " as text)" : column;
                return expression + " ilike (:" + parameter + " || '%')";
            }
            case "ends_with": {
                parameters.put(parameter, textValue(value));
                String expression = timestamp ? "cast(" + column + " as text)" : column;
                return expression + " ilike ('%' || :" + parameter + ")";
            }
            case "gt":
            case "gte":
            case "lt":
            case "lte": {
                parameters.put(parameter, textValue(value));
                String sqlOperator = switch (op) {
                    case "gt" -> ">";
                    case "gte" -> ">=";
                    case "lt" -> "<";
                    default -> "<=";
                };
                return timestamp
                        ? column + " " + sqlOperator + " cast(:" + parameter + " as timestamptz)"
                        : column + " " + sqlOperator + " :" + parameter;
            }
            default:
                throw new BadRequestException("INVALID_SEGMENT_OPERATOR",
                        "Unsupported segment operator: " + op);
        }
    }

    private String compileTagRule(String op,
                                  JsonNode value,
                                  String parameter,
                                  Map<String, Object> parameters) {
        String base = "exists (select 1 from contact_tags ct join tags t on t.id = ct.tag_id "
                + "where ct.contact_id = c.id and t.organization_id = :orgId";
        switch (op) {
            case "exists":
                return base + ")";
            case "not_exists":
                return "not " + base + ")";
            case "eq":
                parameters.put(parameter, textValue(value));
                return base + " and lower(t.name) = lower(:" + parameter + "))";
            case "neq":
                parameters.put(parameter, textValue(value));
                return "not " + base + " and lower(t.name) = lower(:" + parameter + "))";
            case "contains":
                parameters.put(parameter, textValue(value));
                return base + " and t.name ilike ('%' || :" + parameter + " || '%'))";
            case "starts_with":
                parameters.put(parameter, textValue(value));
                return base + " and t.name ilike (:" + parameter + " || '%'))";
            case "ends_with":
                parameters.put(parameter, textValue(value));
                return base + " and t.name ilike ('%' || :" + parameter + "))";
            case "in": {
                List<String> values = textValues(value);
                if (values.isEmpty()) {
                    throw new BadRequestException("INVALID_SEGMENT_RULE",
                            "The in operator requires a non-empty array value");
                }
                parameters.put(parameter, values.stream()
                        .map(item -> item.toLowerCase(Locale.ROOT))
                        .toList());
                return base + " and lower(t.name) in (:" + parameter + "))";
            }
            case "gt":
            case "gte":
            case "lt":
            case "lte": {
                parameters.put(parameter, textValue(value));
                String sqlOperator = switch (op) {
                    case "gt" -> ">";
                    case "gte" -> ">=";
                    case "lt" -> "<";
                    default -> "<=";
                };
                return base + " and t.name " + sqlOperator + " :" + parameter + ")";
            }
            default:
                throw new BadRequestException("INVALID_SEGMENT_OPERATOR",
                        "Unsupported segment operator: " + op);
        }
    }

    private String text(JsonNode node) {
        return node == null || node.isNull() ? null : node.asText();
    }

    private String textValue(JsonNode value) {
        if (value == null || value.isNull()) {
            throw new BadRequestException("INVALID_SEGMENT_RULE",
                    "This operator requires a value");
        }
        if (value.isContainerNode()) {
            throw new BadRequestException("INVALID_SEGMENT_RULE",
                    "This operator requires a scalar value");
        }
        return value.asText();
    }

    private List<String> textValues(JsonNode value) {
        if (value == null || !value.isArray()) {
            throw new BadRequestException("INVALID_SEGMENT_RULE",
                    "The in operator requires an array value");
        }
        List<String> values = new ArrayList<>();
        for (JsonNode element : value) {
            if (element != null && !element.isNull()) {
                values.add(element.asText());
            }
        }
        return values;
    }
}
