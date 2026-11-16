import type { Channel, Template, TemplateVariable } from "@/lib/types";
import { titleCase } from "@/lib/format";
import { extractTemplateVariables } from "../campaign-utils";

export const TEMPLATE_STATUS_TABS = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" }
] as const;

export type TemplateStatusTab = (typeof TEMPLATE_STATUS_TABS)[number]["value"];

export interface TemplateFormState {
  name: string;
  channel: Channel;
  subject: string;
  body: string;
  htmlBody: string;
  variables: TemplateVariable[];
}

export interface TemplatePayload {
  name: string;
  channel: Channel;
  subject: string | null;
  body: string;
  htmlBody: string | null;
  variables: TemplateVariable[];
}

/**
 * Older API responses represent variables as plain `string[]`, while the
 * frontend contract uses descriptor objects. Normalise both shapes safely.
 */
export function normalizeTemplateVariables(value: unknown): TemplateVariable[] {
  if (!Array.isArray(value)) return [];

  const result: TemplateVariable[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item === "string") {
      const name = item.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        result.push({ name, required: false });
      }
      continue;
    }

    if (!item || typeof item !== "object") continue;

    const candidate = item as Record<string, unknown>;
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    if (!name || seen.has(name)) continue;

    seen.add(name);
    const variable: TemplateVariable = { name };
    if (typeof candidate.label === "string") variable.label = candidate.label;
    if (typeof candidate.required === "boolean") variable.required = candidate.required;
    if (typeof candidate.defaultValue === "string") variable.defaultValue = candidate.defaultValue;
    result.push(variable);
  }

  return result;
}

export function emptyTemplateForm(channel: Channel = "EMAIL"): TemplateFormState {
  return {
    name: "",
    channel,
    subject: "",
    body: "",
    htmlBody: "",
    variables: []
  };
}

export function templateToForm(template: Template): TemplateFormState {
  return {
    name: template.name,
    channel: template.channel,
    subject: template.subject ?? "",
    body: template.body,
    htmlBody: template.htmlBody ?? "",
    variables: normalizeTemplateVariables(template.variables).map((variable) => ({ ...variable }))
  };
}

export function toTemplatePayload(form: TemplateFormState): TemplatePayload {
  return {
    name: form.name.trim(),
    channel: form.channel,
    subject: form.channel === "EMAIL" ? form.subject.trim() || null : null,
    body: form.body,
    htmlBody: form.channel === "EMAIL" ? form.htmlBody.trim() || null : null,
    variables: form.variables
      .filter((variable) => variable.name.trim())
      .map((variable) => ({
        name: variable.name.trim(),
        label: variable.label?.trim() || undefined,
        required: Boolean(variable.required),
        defaultValue: variable.defaultValue?.trim() || undefined
      }))
  };
}

export function initialVariableValues(variables: TemplateVariable[]): Record<string, string> {
  const entries: [string, string][] = [];
  for (const variable of normalizeTemplateVariables(variables)) {
    entries.push([variable.name, variable.defaultValue ?? ""]);
  }
  return Object.fromEntries(entries);
}

export function mergeDetectedVariables(variables: TemplateVariable[], text: string): TemplateVariable[] {
  const current = normalizeTemplateVariables(variables);
  const existing = new Set(current.map((variable) => variable.name));
  const detected = extractTemplateVariables(text).filter((name) => !existing.has(name));
  if (detected.length === 0) return current;
  return [
    ...current,
    ...detected.map((name) => ({ name, label: titleCase(name), required: false }))
  ];
}
