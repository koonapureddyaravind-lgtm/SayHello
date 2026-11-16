import { format, isToday, isYesterday, parseISO } from "date-fns";
import type { Channel } from "@/lib/types";

export const CONVERSATION_TABS = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "PENDING", label: "Pending" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "SNOOZED", label: "Snoozed" }
] as const;

export type ConversationTab = (typeof CONVERSATION_TABS)[number]["value"];

export const CHANNEL_FILTERS: { value: Channel | "ALL"; label: string }[] = [
  { value: "ALL", label: "All channels" },
  { value: "EMAIL", label: "Email" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "SMS", label: "SMS" }
];

export function conversationTimestamp(value: string | null | undefined): string {
  if (!value) return "";
  const date = parseISO(value);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d");
}

export function messageTime(value: string | null | undefined): string {
  if (!value) return "";
  return format(parseISO(value), "HH:mm");
}

export function dayLabel(value: string): string {
  const date = parseISO(value);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMM d");
}

export function dayKey(value: string): string {
  return format(parseISO(value), "yyyy-MM-dd");
}
