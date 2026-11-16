import { titleCase, truncate } from "@/lib/format";
import type { SegmentRule } from "@/lib/types";

export interface RuleFieldOption {
  value: string;
  label: string;
  placeholder?: string;
  inputType?: "text" | "date";
}

export const RULE_FIELD_OPTIONS: RuleFieldOption[] = [
  { value: "email", label: "Email", placeholder: "name@example.com" },
  { value: "phone", label: "Phone", placeholder: "+1 555 010 2030" },
  { value: "first_name", label: "First name", placeholder: "Ada" },
  { value: "last_name", label: "Last name", placeholder: "Lovelace" },
  { value: "status", label: "Status", placeholder: "ACTIVE" },
  { value: "source", label: "Source", placeholder: "MANUAL" },
  { value: "created_at", label: "Created at", inputType: "date" },
  { value: "last_engagement_at", label: "Last engagement", inputType: "date" },
  { value: "tag", label: "Tag", placeholder: "VIP" },
  { value: "attribute", label: "Custom attribute…", placeholder: "attribute value" }
];

export const RULE_OPERATOR_OPTIONS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "in", label: "is any of" },
  { value: "gt", label: "is greater than" },
  { value: "gte", label: "is greater or equal" },
  { value: "lt", label: "is less than" },
  { value: "lte", label: "is less or equal" },
  { value: "exists", label: "exists" },
  { value: "not_exists", label: "does not exist" }
];

export const ATTRIBUTE_FIELD_PREFIX = "attribute.";

/** `exists`/`not_exists` compile without a value; every other operator needs one. */
export function operatorNeedsValue(operator: string): boolean {
  return operator !== "exists" && operator !== "not_exists";
}

/** `in` expects an array; the form accepts a comma-separated list. */
export function operatorIsMultiValue(operator: string): boolean {
  return operator === "in";
}

const FIELD_ALIASES: Record<string, string> = {
  firstName: "first_name",
  lastName: "last_name",
  createdAt: "created_at",
  lastEngagementAt: "last_engagement_at"
};

/** The backend whitelists snake_case contact columns. Normalise friendly aliases. */
export function normalizeRuleField(field: string): string {
  if (field.startsWith("attributes.")) return `${ATTRIBUTE_FIELD_PREFIX}${field.slice("attributes.".length)}`;
  return FIELD_ALIASES[field] ?? field;
}

export function isAttributeRule(field: string): boolean {
  return field.startsWith(ATTRIBUTE_FIELD_PREFIX);
}

export function attributeKeyOf(field: string): string {
  return isAttributeRule(field) ? field.slice(ATTRIBUTE_FIELD_PREFIX.length) : "";
}

export function ruleFieldLabel(field: string): string {
  const normalized = normalizeRuleField(field);
  if (isAttributeRule(normalized)) return titleCase(attributeKeyOf(normalized).replace(/[._-]+/g, " "));
  const option = RULE_FIELD_OPTIONS.find((item) => item.value === normalized);
  return option?.label ?? titleCase(normalized.replace(/_/g, " "));
}

export function ruleOperatorLabel(operator: string): string {
  return RULE_OPERATOR_OPTIONS.find((item) => item.value === operator)?.label ?? operator;
}

export function ruleValueLabel(rule: SegmentRule): string {
  if (rule.operator === "exists" || rule.operator === "not_exists") return "—";
  if (rule.value === null || rule.value === undefined || rule.value === "") return "—";
  if (Array.isArray(rule.value)) return rule.value.map((item) => String(item)).join(", ");
  if (typeof rule.value === "object") return JSON.stringify(rule.value);
  return String(rule.value);
}

export function describeRule(rule: SegmentRule): string {
  return `${ruleFieldLabel(rule.field)} ${ruleOperatorLabel(rule.operator)} ${ruleValueLabel(rule)}`;
}

export function ruleSummary(rule: SegmentRule): string {
  return truncate(describeRule(rule), 72);
}
