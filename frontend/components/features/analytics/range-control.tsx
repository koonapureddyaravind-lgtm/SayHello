"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { RANGE_OPTIONS, type RangeDays } from "@/components/features/analytics/shared";

export function RangeControl({
  days,
  onDaysChange,
  onRefresh,
  refreshing
}: {
  days: RangeDays;
  onDaysChange: (days: RangeDays) => void;
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-card/70 p-1 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onDaysChange(option)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              days === option
                ? "bg-brand-gradient text-white shadow-sm"
                : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground dark:hover:bg-white/[0.06]"
            )}
            aria-pressed={days === option}
          >
            {option}d
          </button>
        ))}
      </div>
      <Button variant="outline" size="sm" className="h-9" onClick={onRefresh} loading={refreshing}>
        <RefreshCw /> Refresh
      </Button>
    </div>
  );
}
