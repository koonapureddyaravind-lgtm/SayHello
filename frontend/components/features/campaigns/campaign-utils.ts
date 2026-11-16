import type { Campaign, CampaignStats, Channel } from "@/lib/types";
import { toDate } from "@/lib/format";

export const CHANNEL_OPTIONS: { value: Channel; label: string }[] = [
  { value: "EMAIL", label: "Email" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "SMS", label: "SMS" }
];

export const CAMPAIGN_STATUS_TABS = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "QUEUED", label: "Queued" },
  { value: "RUNNING", label: "Running" },
  { value: "PAUSED", label: "Paused" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "FAILED", label: "Failed" }
] as const;

export type CampaignStatusTab = (typeof CAMPAIGN_STATUS_TABS)[number]["value"];

export const RECIPIENT_STATUSES = ["PENDING", "QUEUED", "SENT", "DELIVERED", "FAILED", "SKIPPED"] as const;

export function toNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export interface NormalizedCampaignStats {
  totalRecipients: number;
  pending: number;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  skipped: number;
  opened: number;
  reached: number;
  deliveryRate: number;
  hasStats: boolean;
}

export function normalizeCampaignStats(stats?: CampaignStats | null): NormalizedCampaignStats {
  const pending = toNumber(stats?.pending);
  const queued = toNumber(stats?.queued);
  const sent = toNumber(stats?.sent);
  const delivered = toNumber(stats?.delivered);
  const failed = toNumber(stats?.failed);
  const skipped = toNumber(stats?.skipped);
  const opened = toNumber(stats?.opened);
  const reached = sent + delivered;
  const fallbackTotal = pending + queued + sent + delivered + failed + skipped;
  const totalRecipients =
    typeof stats?.totalRecipients === "number" && Number.isFinite(stats.totalRecipients)
      ? Math.max(0, stats.totalRecipients)
      : fallbackTotal;

  const rawRate = stats?.deliveryRate;
  const deliveryRate =
    typeof rawRate === "number" && Number.isFinite(rawRate)
      ? rawRate <= 1
        ? rawRate * 100
        : rawRate
      : reached > 0
        ? (delivered / reached) * 100
        : 0;

  return {
    totalRecipients,
    pending,
    queued,
    sent,
    delivered,
    failed,
    skipped,
    opened,
    reached,
    deliveryRate: Math.min(100, Math.max(0, deliveryRate)),
    hasStats: Boolean(stats) && (fallbackTotal > 0 || totalRecipients > 0)
  };
}

export function canLaunchCampaign(status: string): boolean {
  return status === "DRAFT" || status === "SCHEDULED" || status === "PAUSED";
}

export function canPauseCampaign(status: string): boolean {
  return status === "QUEUED" || status === "RUNNING";
}

export function canCancelCampaign(status: string): boolean {
  return status === "SCHEDULED" || status === "QUEUED" || status === "RUNNING" || status === "PAUSED";
}

function contentValue(campaign: Pick<Campaign, "content">, key: string): string {
  const value = campaign.content?.[key];
  return typeof value === "string" ? value : "";
}

export function campaignBody(campaign: Pick<Campaign, "content">): string {
  return contentValue(campaign, "body") || contentValue(campaign, "text") || contentValue(campaign, "message");
}

export function campaignHtmlBody(campaign: Pick<Campaign, "content">): string {
  return contentValue(campaign, "htmlBody") || contentValue(campaign, "html");
}

export function interpolateTemplate(text: string, values: Record<string, string>): string {
  if (!text) return "";
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    const value = values[key];
    return value !== undefined && value !== "" ? value : match;
  });
}

export function extractTemplateVariables(text: string): string[] {
  const found = new Set<string>();
  const pattern = /\{\{\s*([\w.]+)\s*\}\}/g;
  let match: RegExpExecArray | null = pattern.exec(text);
  while (match !== null) {
    if (match[1]) found.add(match[1]);
    match = pattern.exec(text);
  }
  return Array.from(found);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function defaultScheduleValue(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

export function dateToLocalInput(value: string | number | Date | null | undefined): string {
  const date = value instanceof Date ? value : toDate(value);
  if (!date) return defaultScheduleValue();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

export function localInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
