"use client";

import { ChartPie } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelDonut } from "@/components/charts/channel-donut";
import { ChannelIcon, channelMeta } from "@/components/common/channel-badge";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import {
  CHANNEL_COLORS,
  CHANNEL_TONES,
  normalizeRate,
  sortChannels
} from "@/components/features/analytics/shared";
import { formatCompact } from "@/lib/format";
import type { ChannelAnalyticsRow } from "@/lib/types";

export function ChannelPerformanceCard({
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
  const sortedRows = sortChannels(rows ?? []);
  const donutData = sortedRows.map((row) => ({
    name: channelMeta(row.channel).label,
    value: row.sent ?? 0,
    color: CHANNEL_COLORS[row.channel]
  }));
  const total = donutData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle>Channel performance</CardTitle>
        <p className="text-sm text-muted-foreground">Delivery health by channel this period.</p>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="mx-auto h-[220px] w-[220px] rounded-full" />
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Channels unavailable"
            message="We couldn't load channel performance."
            onRetry={onRetry}
          />
        ) : sortedRows.length === 0 ? (
          <EmptyState
            icon={ChartPie}
            title="No channel activity"
            description="Sends, deliveries and failures will appear here once a channel is live."
            className="py-10"
          />
        ) : (
          <>
            <ChannelDonut data={donutData} total={total} label="Total sent" />
            <div className="mt-4 space-y-2.5">
              {sortedRows.map((row) => {
                const rate = normalizeRate(row.deliveryRate);
                const meta = channelMeta(row.channel);
                return (
                  <div
                    key={row.channel}
                    className="rounded-2xl border border-border/60 bg-secondary/20 p-3.5 transition-colors hover:bg-secondary/40 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-2.5">
                      <ChannelIcon channel={row.channel} className="size-8 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold">{meta.label}</span>
                          <span className="shrink-0 text-sm font-semibold">{rate.toFixed(1)}%</span>
                        </div>
                        <Progress
                          value={rate}
                          tone={CHANNEL_TONES[row.channel]}
                          className="mt-1.5 h-1.5"
                        />
                      </div>
                    </div>
                    <div className="mt-2.5 grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <p className="text-muted-foreground">Sent</p>
                        <p className="font-semibold">{formatCompact(row.sent)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Delivered</p>
                        <p className="font-semibold text-emerald-600 dark:text-emerald-300">
                          {formatCompact(row.delivered)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Failed</p>
                        <p className="font-semibold text-rose-600 dark:text-rose-300">{formatCompact(row.failed)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
