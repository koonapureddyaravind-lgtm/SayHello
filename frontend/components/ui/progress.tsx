import { cn } from "@/lib/cn";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  tone?: "violet" | "emerald" | "sky" | "amber" | "rose" | "gradient";
}

const tones: Record<NonNullable<ProgressProps["tone"]>, string> = {
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  gradient: "bg-brand-gradient"
};

export function Progress({ value, max = 100, tone = "gradient", className, ...props }: ProgressProps) {
  const safeMax = max > 0 ? max : 100;
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary dark:bg-white/[0.07]", className)} {...props}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", tones[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
