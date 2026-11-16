import { titleCase } from "@/lib/format";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export interface NormalizedPage<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  paginated: boolean;
}

/**
 * Accepts either a bare array or a PageResponse-like envelope and normalizes
 * it to a predictable shape so screens can handle both API variants.
 */
export function normalizePage<T>(data: unknown, fallbackSize = 20): NormalizedPage<T> {
  if (Array.isArray(data)) {
    const items = data as T[];
    return {
      items,
      page: 0,
      size: items.length || fallbackSize,
      totalItems: items.length,
      totalPages: items.length > 0 ? 1 : 0,
      paginated: false
    };
  }

  if (isRecord(data) && Array.isArray(data.items)) {
    const items = data.items as T[];
    const size = toNumber(data.size, fallbackSize) || fallbackSize;
    const page = toNumber(data.page, 0);
    const totalItems = toNumber(data.totalItems, items.length);
    const totalPages = toNumber(data.totalPages, size > 0 ? Math.ceil(totalItems / size) : 0);
    return { items, page, size, totalItems, totalPages, paginated: true };
  }

  return { items: [], page: 0, size: fallbackSize, totalItems: 0, totalPages: 0, paginated: false };
}

export function normalizeList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (isRecord(data) && Array.isArray(data.items)) return data.items as T[];
  return [];
}

export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function prettyJson(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function formatAction(action: string): string {
  return titleCase(action.replace(/[._-]+/g, " "));
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
