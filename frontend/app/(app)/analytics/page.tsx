"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/error-state";
import { AnalyticsStatGrid } from "@/components/features/analytics/analytics-stat-grid";
import { CampaignPerformanceCard } from "@/components/features/analytics/campaign-performance-card";
import { ChannelComparisonChart } from "@/components/features/analytics/channel-comparison-chart";
import { ChannelPerformanceCard } from "@/components/features/analytics/channel-performance-card";
import { MetricChartCard } from "@/components/features/analytics/metric-chart-card";
import { RangeControl } from "@/components/features/analytics/range-control";
import {
  rangeForDays,
  type MetricValue,
  type RangeDays
} from "@/components/features/analytics/shared";
import { apiFetch } from "@/lib/api";
import type {
  AnalyticsOverview,
  CampaignAnalyticsRow,
  ChannelAnalyticsRow,
  TimeseriesPoint
} from "@/lib/types";

export default function AnalyticsPage() {
  const [days, setDays] = React.useState<RangeDays>(30);
  const [metric, setMetric] = React.useState<MetricValue>("sent");

  const range = React.useMemo(() => rangeForDays(days), [days]);

  const overviewQuery = useQuery({
    queryKey: ["analytics", "overview", range],
    queryFn: () => apiFetch<AnalyticsOverview>("/analytics/overview", { query: range })
  });

  const seriesQuery = useQuery({
    queryKey: ["analytics", "timeseries", metric, range],
    queryFn: () => apiFetch<TimeseriesPoint[]>("/analytics/timeseries", { query: { metric, ...range } })
  });

  const channelsQuery = useQuery({
    queryKey: ["analytics", "channels", range],
    queryFn: () => apiFetch<ChannelAnalyticsRow[]>("/analytics/channels", { query: range })
  });

  const campaignsQuery = useQuery({
    queryKey: ["analytics", "campaigns", range],
    queryFn: () => apiFetch<CampaignAnalyticsRow[]>("/analytics/campaigns", { query: range })
  });

  const refreshing =
    overviewQuery.isFetching || seriesQuery.isFetching || channelsQuery.isFetching || campaignsQuery.isFetching;

  const refreshAll = React.useCallback(() => {
    void Promise.allSettled([
      overviewQuery.refetch(),
      seriesQuery.refetch(),
      channelsQuery.refetch(),
      campaignsQuery.refetch()
    ]);
  }, [overviewQuery, seriesQuery, channelsQuery, campaignsQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intelligence"
        title="Analytics"
        description="See how contacts, campaigns and channels perform across every touchpoint — then act on what works."
        actions={
          <RangeControl
            days={days}
            onDaysChange={setDays}
            onRefresh={refreshAll}
            refreshing={refreshing}
          />
        }
      />

      {overviewQuery.isError ? (
        <ErrorState
          title="Analytics are taking a moment"
          message="We couldn't load your workspace metrics. Refresh the page or try again in a moment."
          onRetry={() => void overviewQuery.refetch()}
        />
      ) : null}

      <AnalyticsStatGrid overview={overviewQuery.data} days={days} loading={overviewQuery.isLoading} />

      <div className="grid gap-4 xl:grid-cols-3">
        <MetricChartCard
          className="xl:col-span-2"
          metric={metric}
          onMetricChange={setMetric}
          data={seriesQuery.data}
          days={days}
          isLoading={seriesQuery.isLoading}
          isError={seriesQuery.isError}
          onRetry={() => void seriesQuery.refetch()}
        />
        <ChannelPerformanceCard
          rows={channelsQuery.data}
          isLoading={channelsQuery.isLoading}
          isError={channelsQuery.isError}
          onRetry={() => void channelsQuery.refetch()}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChannelComparisonChart
          rows={channelsQuery.data}
          isLoading={channelsQuery.isLoading}
          isError={channelsQuery.isError}
          onRetry={() => void channelsQuery.refetch()}
        />
        <CampaignPerformanceCard
          className="xl:col-span-2"
          rows={campaignsQuery.data}
          isLoading={campaignsQuery.isLoading}
          isError={campaignsQuery.isError}
          onRetry={() => void campaignsQuery.refetch()}
        />
      </div>
    </div>
  );
}
