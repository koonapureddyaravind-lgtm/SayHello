"use client";

import Link from "next/link";
import { ArrowUpRight, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChannelBadge } from "@/components/common/channel-badge";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StatusBadge } from "@/components/common/status-badge";
import { CHANNEL_TONES } from "@/components/features/analytics/shared";
import { formatCompact, formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CampaignAnalyticsRow } from "@/lib/types";

function deliveryRate(row: CampaignAnalyticsRow): number {
  if (!row.sent) return 0;
  return Math.min(100, Math.max(0, (row.delivered / row.sent) * 100));
}

export function CampaignPerformanceCard({
  rows,
  isLoading,
  isError,
  onRetry,
  className
}: {
  rows?: CampaignAnalyticsRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  className?: string;
}) {
  const sortedRows = [...(rows ?? [])].sort((a, b) => b.sent - a.sent);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div>
          <CardTitle>Campaign performance</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Sorted by sends in the selected period.</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/campaigns">
            All campaigns <ArrowUpRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {isLoading ? (
          <div className="space-y-3 px-6 pb-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="px-6 pb-6">
            <ErrorState
              title="Campaigns unavailable"
              message="We couldn't load campaign analytics."
              onRetry={onRetry}
            />
          </div>
        ) : sortedRows.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaign data"
            description="Campaigns created in this period will show their delivery breakdown here."
            action={
              <Button asChild variant="gradient" size="sm">
                <Link href="/campaigns">View campaigns</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Campaign</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Recipients</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead className="w-[168px] pr-6">Delivery rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((row) => {
                    const rate = deliveryRate(row);
                    return (
                      <TableRow key={row.campaignId}>
                        <TableCell className="pl-6">
                          <Link
                            href={`/campaigns/${row.campaignId}`}
                            className="font-semibold transition-colors hover:text-violet-600 dark:hover:text-violet-300"
                          >
                            {row.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <ChannelBadge channel={row.channel} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(row.totalRecipients)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatNumber(row.sent)}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-300">
                          {formatNumber(row.delivered)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-rose-600 dark:text-rose-300">
                          {formatNumber(row.failed)}
                        </TableCell>
                        <TableCell className="pr-6">
                          <div className="flex items-center gap-2">
                            <Progress value={rate} tone={CHANNEL_TONES[row.channel]} className="h-1.5" />
                            <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums">
                              {rate.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y divide-border/60 md:hidden dark:divide-white/[0.06]">
              {sortedRows.map((row) => {
                const rate = deliveryRate(row);
                return (
                  <div key={row.campaignId} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/campaigns/${row.campaignId}`}
                          className="truncate text-sm font-semibold transition-colors hover:text-violet-600 dark:hover:text-violet-300"
                        >
                          {row.name}
                        </Link>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <ChannelBadge channel={row.channel} className="px-1.5 py-0 text-[10px]" />
                          <StatusBadge status={row.status} className="px-1.5 py-0 text-[10px]" />
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold">{rate.toFixed(0)}%</span>
                    </div>
                    <Progress value={rate} tone={CHANNEL_TONES[row.channel]} className="mt-2.5 h-1.5" />
                    <div className="mt-2.5 grid grid-cols-4 gap-2 text-[11px]">
                      <div>
                        <p className="text-muted-foreground">Recipients</p>
                        <p className="font-semibold">{formatCompact(row.totalRecipients)}</p>
                      </div>
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
