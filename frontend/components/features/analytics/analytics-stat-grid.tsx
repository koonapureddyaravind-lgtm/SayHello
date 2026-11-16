"use client";

import { Gauge, MessageSquare, Send, Users } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";
import { normalizeRate } from "@/components/features/analytics/shared";
import { formatNumber } from "@/lib/format";
import type { AnalyticsOverview } from "@/lib/types";

export function AnalyticsStatGrid({
  overview,
  days,
  loading
}: {
  overview?: AnalyticsOverview;
  days: number;
  loading: boolean;
}) {
  const deliveryRate = normalizeRate(overview?.messages?.deliveryRate);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Total contacts"
        value={overview?.contacts?.total ?? 0}
        icon={Users}
        tone="violet"
        hint={`${formatNumber(overview?.contacts?.newInPeriod ?? 0)} new in ${days} days`}
        loading={loading}
      />
      <StatCard
        label="Messages sent"
        value={overview?.messages?.sent ?? 0}
        icon={Send}
        tone="sky"
        hint={`${formatNumber(overview?.messages?.delivered ?? 0)} delivered`}
        loading={loading}
      />
      <StatCard
        label="Delivery rate"
        value={`${deliveryRate.toFixed(1)}%`}
        icon={Gauge}
        tone="emerald"
        hint={`${formatNumber(overview?.messages?.failed ?? 0)} failed sends`}
        loading={loading}
      />
      <StatCard
        label="Open conversations"
        value={overview?.inbox?.openConversations ?? 0}
        icon={MessageSquare}
        tone="fuchsia"
        hint={`${formatNumber(overview?.inbox?.unreadMessages ?? 0)} unread messages`}
        loading={loading}
      />
    </div>
  );
}
