import { formatDistanceToNowStrict, format, isValid, parseISO } from "date-fns";

export function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : typeof value === "number" ? new Date(value) : parseISO(value);
  return isValid(date) ? date : null;
}

export function formatDate(value: string | number | Date | null | undefined, pattern = "MMM d, yyyy"): string {
  const date = toDate(value);
  return date ? format(date, pattern) : "—";
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  return formatDate(value, "MMM d, yyyy 'at' HH:mm");
}

export function formatTime(value: string | number | Date | null | undefined): string {
  return formatDate(value, "HH:mm");
}

export function formatRelative(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return `${formatDistanceToNowStrict(date)} ago`;
}

export function formatNumber(value: number | null | undefined, options?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0, ...options }).format(value);
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatBytes(value: number | null | undefined): string {
  const bytes = value ?? 0;
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatCurrency(
  minorUnits: number | null | undefined,
  currency = "USD",
  options?: Intl.NumberFormatOptions
): string {
  const amount = (minorUnits ?? 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    ...options
  }).format(amount);
}

export function formatMicros(micros: number | null | undefined, currency = "USD"): string {
  return formatCurrency((micros ?? 0) / 10_000, currency);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  return `${((value ?? 0) * 100).toFixed(digits)}%`;
}

export function percentOf(part: number, total: number): number {
  if (!total) return 0;
  return part / total;
}

export function initials(value: string | null | undefined): string {
  if (!value) return "?";
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function displayName(
  person: { firstName?: string | null; lastName?: string | null; email?: string | null; name?: string | null } | null | undefined
): string {
  if (!person) return "Unknown";
  if (person.name) return person.name;
  const full = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  return full || person.email || "Unknown";
}

export function truncate(value: string | null | undefined, length = 80): string {
  if (!value) return "";
  return value.length > length ? `${value.slice(0, length).trimEnd()}…` : value;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural ?? `${singular}s`}`;
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
