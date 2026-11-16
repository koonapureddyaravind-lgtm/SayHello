"use client";

import Link from "next/link";
import { ChartNoAxesCombined } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { TrendChart } from "@/components/charts/trend-chart";
import { METRICS, type MetricValue } from "@/components/features/analytics/shared";
import { formatCompact, formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { TimeseriesPoint } from "@/lib/types";

export function MetricChartCard({
  metric,
  onMetricChange,
  data,
  days,
  isLoading,
  isError,
  onRetry,
  className
}: {
  metric: MetricValue;
  onMetricChange: (metric: MetricValue) => void;
  data?: TimeseriesPoint[];
  days: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  className?: string;
}) {
  const activeMetric = METRICS.find((item) => item.value === metric) ?? METRICS[0];
  const total = (data ?? []).reduce((sum, point) => sum + (point.value ?? 0), 0);
  const average = days > 0 ? total / days : 0;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Message volume</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Daily {activeMetric.label.toLowerCase()} activity across every channel.
          </p>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-secondary/60 p-1 no-scrollbar dark:bg-white/[0.05]">
          {METRICS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onMetricChange(item.value)}
              aria-pressed={metric === item.value}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                metric === item.value
                  ? "bg-card text-foreground shadow-sm dark:bg-white/[0.1]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="size-1.5 rounded-full" style={{ background: item.color }} />
              {item.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {activeMetric.label} total
              </p>
              <p className="mt-0.5 font-display text-2xl font-semibold tracking-tight">{formatNumber(total)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Average / day</p>
              <p className="mt-0.5 font-display text-2xl font-semibold tracking-tight">{formatCompact(average)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.03]">
            <span className="size-2 rounded-full" style={{ background: activeMetric.color }} />
            {activeMetric.label} · last {days} days
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : isError ? (
          <ErrorState
            title="Chart unavailable"
            message="We couldn't load this timeseries. Try refreshing the analytics."
            onRetry={onRetry}
          />
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={ChartNoAxesCombined}
            title="No activity yet"
            description="Launch a campaign or connect a channel and your volume will appear here."
            className="rounded-2xl border border-dashed border-border/70 py-12 dark:border-white/10"
            action={
              <Button asChild variant="soft" size="sm">
                <Link href="/campaigns">Go to campaigns</Link>
              </Button>
            }
          />
        ) : (
          <TrendChart data={data ?? []} color={activeMetric.color} />
        )}
      </CardContent>
    </Card>
  );
}
