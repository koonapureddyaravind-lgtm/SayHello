import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { roleMeta } from "@/components/features/admin/admin-meta";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

export function RoleBadge({ role, className }: { role: string | null | undefined; className?: string }) {
  const meta = roleMeta(role);
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        meta.chip,
        className
      )}
    >
      <Icon className="size-3" />
      {meta.label}
    </span>
  );
}

const MEMBERSHIP_VARIANTS: Record<string, { label: string; variant: BadgeVariant }> = {
  ACTIVE: { label: "Active", variant: "success" },
  INVITED: { label: "Invited", variant: "info" },
  SUSPENDED: { label: "Suspended", variant: "danger" }
};

export function MemberStatusBadge({ status, className }: { status: string; className?: string }) {
  const upper = status?.toUpperCase?.() ?? "";
  const meta = MEMBERSHIP_VARIANTS[upper] ?? { label: status || "Unknown", variant: "secondary" as BadgeVariant };
  return (
    <Badge variant={meta.variant} className={className}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {meta.label}
    </Badge>
  );
}
