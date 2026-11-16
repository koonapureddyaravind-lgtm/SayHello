import { formatDate, formatMicros, formatNumber, titleCase } from "@/lib/format";

export interface PlanFeature {
  label: string;
  detail?: string;
}

/** Plans store features as free-form JSON. Turn it into readable bullets, skipping unknowns. */
export function planFeatureList(features: Record<string, unknown> | null | undefined): PlanFeature[] {
  if (!features) return [];
  return Object.entries(features)
    .flatMap(([key, value]): PlanFeature[] => {
      const label = titleCase(key);
      if (value === true) return [{ label }];
      if (value === false || value === null || value === undefined) return [];
      if (typeof value === "number") {
        if (!Number.isFinite(value)) return [];
        return [{ label, detail: value < 0 ? "Unlimited" : formatNumber(value) }];
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed ? [{ label, detail: trimmed }] : [];
      }
      if (Array.isArray(value)) {
        const detail = value
          .map((entry) => (typeof entry === "string" ? entry : String(entry)))
          .filter(Boolean)
          .join(", ");
        return detail ? [{ label, detail }] : [];
      }
      return [];
    })
    .slice(0, 8);
}

/** Overage micros are per single send; showing per 1,000 keeps the price legible. */
export function overagePerThousand(micros: number | null | undefined, currency: string): string {
  return formatMicros((micros ?? 0) * 1000, currency);
}

export function includedLabel(value: number | null | undefined): string {
  if (!value || value <= 0) return "Custom";
  return formatNumber(value);
}

export function currentPeriodValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function buildPeriodOptions(count = 6): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: count }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return { value, label: formatDate(date, "MMMM yyyy") };
  });
}

export interface InvoiceLine {
  description: string;
  quantity?: number;
  amountCents?: number;
  unitAmountCents?: number;
  unitCostMicros?: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function numeric(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function parseInvoiceLines(items: unknown[] | null | undefined): InvoiceLine[] {
  if (!items?.length) return [];
  return items.map((item) => {
    const record = asRecord(item);
    if (!record) {
      return { description: String(item) };
    }
    return {
      description:
        typeof record.description === "string"
          ? record.description
          : typeof record.metric === "string"
            ? titleCase(record.metric.replace(/_SENT$/, ""))
            : "Line item",
      quantity: numeric(record.quantity),
      amountCents: numeric(record.amountCents),
      unitAmountCents: numeric(record.unitAmountCents),
      unitCostMicros: numeric(record.unitCostMicros)
    };
  });
}
