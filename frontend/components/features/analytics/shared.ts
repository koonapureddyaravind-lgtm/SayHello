import type { Channel } from "@/lib/types";

export const RANGE_OPTIONS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

export const METRICS = [
  { value: "sent", label: "Sent", color: "#7c3aed" },
  { value: "delivered", label: "Delivered", color: "#10b981" },
  { value: "opened", label: "Opened", color: "#d946ef" },
  { value: "failed", label: "Failed", color: "#f43f5e" }
] as const;

export type MetricValue = (typeof METRICS)[number]["value"];

export const CHANNEL_ORDER: Channel[] = ["EMAIL", "WHATSAPP", "SMS"];

export const CHANNEL_COLORS: Record<Channel, string> = {
  EMAIL: "#0ea5e9",
  WHATSAPP: "#10b981",
  SMS: "#f59e0b"
};

export const CHANNEL_TONES: Record<Channel, "sky" | "emerald" | "amber"> = {
  EMAIL: "sky",
  WHATSAPP: "emerald",
  SMS: "amber"
};

/** Delivery rates may arrive either as a fraction (0–1) or a percentage (0–100). */
export function normalizeRate(rate: number | null | undefined): number {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return 0;
  return rate <= 1 ? rate * 100 : rate;
}

export function channelRank(channel: Channel): number {
  const index = CHANNEL_ORDER.indexOf(channel);
  return index === -1 ? CHANNEL_ORDER.length : index;
}

export function sortChannels<T extends { channel: Channel }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => channelRank(a.channel) - channelRank(b.channel));
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function rangeForDays(days: RangeDays): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: isoDate(from), to: isoDate(to) };
}
