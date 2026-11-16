import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCompact } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

type Tone = "violet" | "fuchsia" | "sky" | "emerald" | "amber" | "rose";

const toneStyles: Record<Tone, { icon: string; ring: string; orb: string; delta: string }> = {
  violet: {
    icon: "from-indigo-500 to-violet-600 shadow-violet-500/40",
    ring: "border-violet-200/70 dark:border-violet-400/20",
    orb: "bg-violet-400/25",
    delta: "text-violet-600 dark:text-violet-300"
  },
  fuchsia: {
    icon: "from-fuchsia-500 to-pink-600 shadow-fuchsia-500/40",
    ring: "border-fuchsia-200/70 dark:border-fuchsia-400/20",
    orb: "bg-fuchsia-400/25",
    delta: "text-fuchsia-600 dark:text-fuchsia-300"
  },
  sky: {
    icon: "from-sky-500 to-blue-600 shadow-sky-500/40",
    ring: "border-sky-200/70 dark:border-sky-400/20",
    orb: "bg-sky-400/25",
    delta: "text-sky-600 dark:text-sky-300"
  },
  emerald: {
    icon: "from-emerald-500 to-teal-600 shadow-emerald-500/40",
    ring: "border-emerald-200/70 dark:border-emerald-400/20",
    orb: "bg-emerald-400/25",
    delta: "text-emerald-600 dark:text-emerald-300"
  },
  amber: {
    icon: "from-amber-400 to-orange-600 shadow-amber-500/40",
    ring: "border-amber-200/70 dark:border-amber-400/20",
    orb: "bg-amber-400/25",
    delta: "text-amber-600 dark:text-amber-300"
  },
  rose: {
    icon: "from-rose-500 to-red-600 shadow-rose-500/40",
    ring: "border-rose-200/70 dark:border-rose-400/20",
    orb: "bg-rose-400/25",
    delta: "text-rose-600 dark:text-rose-300"
  }
};

export function StatCard({
  label,
  value,
  suffix,
  icon: Icon,
  tone = "violet",
  delta,
  hint,
  loading
}: {
  label: string;
  value: number | string;
  suffix?: string;
  icon: LucideIcon;
  tone?: Tone;
  delta?: number;
  hint?: string;
  loading?: boolean;
}) {
  const styles = toneStyles[tone];
  const DeltaIcon = delta === undefined || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      className={cn(
        "stat-sheen group relative overflow-hidden rounded-3xl border bg-card/80 p-5 shadow-card backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-float dark:bg-white/[0.035]",
        styles.ring
      )}
    >
      <div className={cn("pointer-events-none absolute -right-8 -top-10 size-32 rounded-full blur-3xl transition-opacity group-hover:opacity-100", styles.orb)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-3 h-8 w-24" />
          ) : (
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-display text-3xl font-semibold tracking-tight">
                {typeof value === "number" ? formatCompact(value) : value}
              </span>
              {suffix ? <span className="text-xs font-medium text-muted-foreground">{suffix}</span> : null}
            </div>
          )}
          {hint || delta !== undefined ? (
            <div className="mt-2.5 flex items-center gap-2 text-xs">
              {delta !== undefined ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
                    delta > 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : delta < 0 ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : "bg-secondary text-muted-foreground"
                  )}
                >
                  <DeltaIcon className="size-3" />
                  {Math.abs(delta).toFixed(1)}%
                </span>
              ) : null}
              {hint ? <span className="truncate text-muted-foreground">{hint}</span> : null}
            </div>
          ) : null}
        </div>
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3",
            styles.icon
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}
