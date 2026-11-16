"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartColumn } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { channelMeta } from "@/components/common/channel-badge";
import { CHANNEL_ORDER, channelRank } from "@/components/features/analytics/shared";
import { formatCompact, formatNumber } from "@/lib/format";
import type { ChannelAnalyticsRow } from "@/lib/types";

const SERIES = [
  { key: "sent", label: "Sent", color: "#7c3aed" },
  { key: "delivered", label: "Delivered", color: "#10b981" },
  { key: "failed", label: "Failed", color: "#f43f5e" }
] as const;

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; name?: string; value?: number; color?: string }>;
  label?: string;
}

function ComparisonTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-violet-200/60 bg-card/95 px-3 py-2.5 shadow-float backdrop-blur-xl dark:border-white/10 dark:bg-[#171026]/95">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1.5 space-y-1">
        {payload.map((item) => (
          <div key={String(item.dataKey)} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-1.5 rounded-full" style={{ background: item.color }} />
              {item.name}
            </span>
            <span className="font-semibold text-foreground">{formatNumber(item.value ?? 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChannelComparisonChart({
  rows,
  isLoading,
  isError,
  onRetry
}: {
  rows?: ChannelAnalyticsRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const availableRows = [...(rows ?? [])].sort((a, b) => channelRank(a.channel) - channelRank(b.channel));
  const data = CHANNEL_ORDER.filter((channel) => availableRows.some((row) => row.channel === channel)).map((channel) => {
    const row = availableRows.find((item) => item.channel === channel);
    return {
      name: channelMeta(channel).label,
      sent: row?.sent ?? 0,
      delivered: row?.delivered ?? 0,
      failed: row?.failed ?? 0
    };
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Channel comparison</CardTitle>
        <p className="text-sm text-muted-foreground">Sent, delivered and failed side by side.</p>
        <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-muted-foreground">
          {SERIES.map((series) => (
            <span key={series.key} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: series.color }} />
              {series.label}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : isError ? (
          <ErrorState
            title="Comparison unavailable"
            message="We couldn't load channel volume."
            onRetry={onRetry}
          />
        ) : data.length === 0 ? (
          <EmptyState
            icon={ChartColumn}
            title="Nothing to compare"
            description="Channel volume appears here after your first sends."
            className="py-10"
          />
        ) : (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="4 6" stroke="rgba(124,58,237,0.12)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "currentColor", opacity: 0.55 }}
                  dy={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }}
                  tickFormatter={(value: number) => formatCompact(value)}
                  width={48}
                />
                <Tooltip content={<ComparisonTooltip />} cursor={{ fill: "rgba(124,58,237,0.06)" }} />
                {SERIES.map((series) => (
                  <Bar
                    key={series.key}
                    dataKey={series.key}
                    name={series.label}
                    fill={series.color}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={18}
                    animationDuration={700}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
