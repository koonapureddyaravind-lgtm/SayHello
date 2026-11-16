import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

export function Logo({
  href = "/dashboard",
  compact = false,
  onDark = false,
  className
}: {
  href?: string;
  compact?: boolean;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)}>
      <span className="relative flex size-9 items-center justify-center overflow-hidden rounded-xl bg-brand-gradient shadow-[0_8px_24px_-8px_rgba(124,58,237,0.8)] transition-transform duration-300 group-hover:scale-105">
        <span className="absolute inset-0 bg-shine bg-[length:200%_100%] opacity-0 transition-opacity group-hover:animate-shimmer group-hover:opacity-100" />
        <Sparkles className="size-[18px] text-white" strokeWidth={2.2} />
      </span>
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span className={cn("font-display text-[17px] font-bold tracking-tight", onDark ? "text-white" : "text-foreground")}>
            com<span className="gradient-text">Gpt</span>
          </span>
          <span
            className={cn(
              "mt-1 text-[9px] font-semibold uppercase tracking-[0.22em]",
              onDark ? "text-white/40" : "text-muted-foreground"
            )}
          >
            Growth OS
          </span>
        </span>
      ) : null}
    </Link>
  );
}
