import { Badge, type BadgeProps } from "@/components/ui/badge";
import { titleCase } from "@/lib/format";

type Variant = NonNullable<BadgeProps["variant"]>;

const STATUS_VARIANTS: Record<string, Variant> = {
  // campaign
  DRAFT: "secondary",
  SCHEDULED: "info",
  QUEUED: "purple",
  RUNNING: "gradient",
  PAUSED: "warning",
  COMPLETED: "success",
  CANCELLED: "outline",
  FAILED: "danger",
  // message / recipient
  CREATED: "secondary",
  SENDING: "info",
  SENT: "purple",
  DELIVERED: "success",
  READ: "success",
  BOUNCED: "danger",
  REJECTED: "danger",
  UNDELIVERABLE: "danger",
  // recipient-only
  PENDING: "warning",
  SKIPPED: "outline",
  // workflow
  ACTIVE: "success",
  ARCHIVED: "outline",
  // execution
  WAITING: "warning",
  // conversation
  OPEN: "info",
  RESOLVED: "success",
  SNOOZED: "secondary",
  // consent
  GRANTED: "success",
  DENIED: "danger",
  WITHDRAWN: "warning",
  // template
  PUBLISHED: "success",
  // contact
  UNSUBSCRIBED: "warning",
  DELETED: "outline",
  PARTIAL: "warning",
  UPLOADING: "info",
  // billing
  PAID: "success",
  OVERDUE: "danger",
  VOID: "outline",
  TRIALING: "info",
  PAST_DUE: "danger",
  CANCELED: "outline",
  DISABLED: "outline",
  ERROR: "danger"
};

const DOT_COLORS: Record<string, string> = {
  RUNNING: "bg-white/90",
  ACTIVE: "bg-emerald-500",
  DELIVERED: "bg-emerald-500",
  READ: "bg-emerald-500",
  GRANTED: "bg-emerald-500",
  COMPLETED: "bg-emerald-500",
  PAID: "bg-emerald-500",
  FAILED: "bg-rose-500",
  BOUNCED: "bg-rose-500",
  REJECTED: "bg-rose-500",
  UNDELIVERABLE: "bg-rose-500",
  DENIED: "bg-rose-500",
  ERROR: "bg-rose-500",
  OVERDUE: "bg-rose-500",
  PAUSED: "bg-amber-500",
  PENDING: "bg-amber-500",
  WAITING: "bg-amber-500",
  SCHEDULED: "bg-sky-500",
  QUEUED: "bg-fuchsia-500",
  SENT: "bg-violet-500",
  UPLOADING: "bg-sky-500",
  PARTIAL: "bg-amber-500"
};

const LABELS: Record<string, string> = {
  CREATED: "Created",
  UNDELIVERABLE: "Undeliverable",
  PAST_DUE: "Past due"
};

export function StatusBadge({ status, dot = true, className }: { status: string; dot?: boolean; className?: string }) {
  const upper = status?.toUpperCase?.() ?? status;
  const variant = STATUS_VARIANTS[upper] ?? "secondary";
  const dotClass = DOT_COLORS[upper];
  const isGradient = variant === "gradient";

  return (
    <Badge variant={variant} className={className}>
      {dot ? (
        <span
          className={
            isGradient
              ? "size-1.5 rounded-full bg-white/90 animate-pulse"
              : `size-1.5 rounded-full ${dotClass ?? "bg-current opacity-70"}`
          }
        />
      ) : null}
      {LABELS[upper] ?? titleCase(upper)}
    </Badge>
  );
}
