"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Gauge,
  Megaphone,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Users
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { ChannelBadge, ChannelIcon, channelMeta } from "@/components/common/channel-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { CardTabs } from "@/components/ui/card-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TrendChart } from "@/components/charts/trend-chart";
import { ChannelDonut } from "@/components/charts/channel-donut";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { apiFetch } from "@/lib/api";
import { formatCompact, formatDate, formatNumber, initials, truncate } from "@/lib/format";
import type {
  AnalyticsOverview,
  Campaign,
  ChannelAnalyticsRow,
  Conversation,
  PageResponse,
  TimeseriesPoint
} from "@/lib/types";

const METRICS = [
  { value: "sent", label: "Sent", color: "#7c3aed" },
  { value: "delivered", label: "Delivered", color: "#10b981" },
  { value: "opened", label: "Opened", color: "#d946ef" },
  { value: "failed", label: "Failed", color: "#f43f5e" }
] as const;

const CHANNEL_COLORS: Record<string, string> = {
  EMAIL: "#0ea5e9",
  WHATSAPP: "#10b981",
  SMS: "#f59e0b"
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function ratePercent(rate: number | undefined): number {
  if (rate === undefined || Number.isNaN(rate)) return 0;
  return rate <= 1 ? rate * 100 : rate;
}

function firstName(name: string | undefined | null): string {
  if (!name) return "there";
  return name.trim().split(/\s+/)[0] ?? "there";
}

export default function DashboardPage() {
  const { user, currentOrganization } = useWorkspace();
  const [metric, setMetric] = React.useState<(typeof METRICS)[number]["value"]>("sent");
  const [days, setDays] = React.useState(30);

  const range = React.useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    return { from: isoDate(from), to: isoDate(to) };
  }, [days]);

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
    queryKey: ["campaigns", "recent"],
    queryFn: () => apiFetch<PageResponse<Campaign>>("/campaigns", { query: { page: 0, size: 5 } })
  });

  const conversationsQuery = useQuery({
    queryKey: ["conversations", "recent"],
    queryFn: () => apiFetch<PageResponse<Conversation>>("/conversations", { query: { page: 0, size: 5, status: "OPEN" } })
  });

  const overview = overviewQuery.data;
  const deliveryRate = ratePercent(overview?.messages?.deliveryRate);
  const channelRows = channelsQuery.data ?? [];
  const donutData = channelRows.length
    ? channelRows.map((row) => ({
        name: channelMeta(row.channel).label,
        value: row.sent ?? 0,
        color: CHANNEL_COLORS[row.channel] ?? "#7c3aed"
      }))
    : [
        { name: "Email", value: 0, color: CHANNEL_COLORS.EMAIL },
        { name: "WhatsApp", value: 0, color: CHANNEL_COLORS.WHATSAPP },
        { name: "SMS", value: 0, color: CHANNEL_COLORS.SMS }
      ];
  const donutTotal = donutData.reduce((sum, item) => sum + item.value, 0);
  const activeMetric = METRICS.find((item) => item.value === metric) ?? METRICS[0];
  const campaigns = campaignsQuery.data?.items ?? [];
  const conversations = conversationsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] bg-[#0b0618] p-6 text-white shadow-float sm:p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 -top-20 size-72 rounded-full bg-violet-600/40 blur-[100px]" />
          <div className="absolute right-1/4 top-1/2 size-64 rounded-full bg-fuchsia-600/25 blur-[100px]" />
          <div className="absolute -bottom-24 right-0 size-72 rounded-full bg-amber-500/15 blur-[100px]" />
          <div className="absolute inset-0 bg-grid-fade bg-[length:40px_40px] opacity-30" />
        </div>

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-white/70 backdrop-blur">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live workspace · {currentOrganization?.name ?? "comGpt"}
            </span>
            <h1 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-[34px]">
              {greeting()}, <span className="gradient-text">{firstName(user?.fullName)}</span>
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/55">
              Here&apos;s how your channels performed over the last {days} days. Every send, reply and conversion in one
              place.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button asChild variant="gradient" className="rounded-xl">
                <Link href="/campaigns?create=1">
                  <Plus /> New campaign
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.12] hover:text-white dark:border-white/15 dark:bg-white/[0.06]">
                <Link href="/analytics">
                  <ChartNoAxesCombined /> View analytics
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl text-white/60 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  void overviewQuery.refetch();
                  void seriesQuery.refetch();
                  void channelsQuery.refetch();
                }}
                loading={overviewQuery.isFetching}
              >
                <RefreshCw /> Refresh
              </Button>
            </div>
          </div>

          <div className="relative hidden h-52 w-64 shrink-0 items-center justify-center lg:flex">
            <div className="absolute inset-0 animate-float">
              <div className="absolute inset-2 rounded-full border border-white/10" />
              <div className="absolute inset-8 rounded-full border border-violet-400/25" />
              <div className="absolute inset-14 rounded-full border border-fuchsia-400/20" />
              <div className="absolute inset-4 rounded-full bg-[conic-gradient(from_200deg,rgba(217,70,239,0.35),transparent_40%,rgba(20,184,166,0.3),transparent_78%)] opacity-70 blur-xl" />
            </div>
            <div className="relative flex size-28 flex-col items-center justify-center rounded-full border border-white/15 bg-white/[0.07] backdrop-blur-xl">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">Delivered</span>
              <span className="font-display text-2xl font-semibold">{deliveryRate.toFixed(1)}%</span>
            </div>
            <div className="absolute right-0 top-3 rounded-xl border border-white/10 bg-white/[0.08] px-3 py-1.5 text-right backdrop-blur-xl">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Contacts</p>
              <p className="font-display text-sm font-semibold">{formatCompact(overview?.contacts?.total ?? 0)}</p>
            </div>
            <div className="absolute bottom-2 left-0 rounded-xl border border-white/10 bg-white/[0.08] px-3 py-1.5 backdrop-blur-xl">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Active campaigns</p>
              <p className="font-display text-sm font-semibold">{formatNumber(overview?.campaigns?.active ?? 0)}</p>
            </div>
          </div>
        </div>
      </section>

      {overviewQuery.isError ? (
        <ErrorState
          title="Analytics are taking a moment"
          message="We couldn't load your workspace metrics. The rest of the dashboard is still available."
          onRetry={() => void overviewQuery.refetch()}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total contacts"
          value={overview?.contacts?.total ?? 0}
          icon={Users}
          tone="violet"
          hint={`${formatNumber(overview?.contacts?.newInPeriod ?? 0)} new in ${days} days`}
          loading={overviewQuery.isLoading}
        />
        <StatCard
          label="Messages sent"
          value={overview?.messages?.sent ?? 0}
          icon={Send}
          tone="sky"
          hint={`${formatNumber(overview?.messages?.delivered ?? 0)} delivered`}
          loading={overviewQuery.isLoading}
        />
        <StatCard
          label="Delivery rate"
          value={`${deliveryRate.toFixed(1)}%`}
          icon={Gauge}
          tone="emerald"
          hint={`${formatNumber(overview?.messages?.failed ?? 0)} failed sends`}
          loading={overviewQuery.isLoading}
        />
        <StatCard
          label="Open conversations"
          value={overview?.inbox?.openConversations ?? 0}
          icon={MessageSquare}
          tone="fuchsia"
          hint={`${formatNumber(overview?.inbox?.unreadMessages ?? 0)} unread messages`}
          loading={overviewQuery.isLoading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Message volume</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Daily performance across every channel.</p>
            </div>
            <CardTabs
              tabs={METRICS.map((item) => ({ value: item.value, label: item.label }))}
              value={metric}
              onValueChange={(value) => setMetric(value as typeof metric)}
            />
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: activeMetric.color }} />
                {activeMetric.label} · last {days} days
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-secondary/60 p-1 dark:bg-white/[0.05]">
                {[30, 60, 90].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDays(option)}
                    className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                      days === option ? "bg-card text-foreground shadow-sm dark:bg-white/10" : "text-muted-foreground"
                    }`}
                  >
                    {option}d
                  </button>
                ))}
              </div>
            </div>
            {seriesQuery.isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : seriesQuery.isError ? (
              <ErrorState title="Chart unavailable" message="We couldn't load this timeseries." onRetry={() => void seriesQuery.refetch()} />
            ) : (seriesQuery.data?.length ?? 0) === 0 ? (
              <div className="flex h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 text-center">
                <ChartNoAxesCombined className="mb-3 size-8 text-violet-400" />
                <p className="font-display text-sm font-semibold">No activity yet</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Launch a campaign or connect a channel and your volume will appear here.
                </p>
                <Button asChild size="sm" variant="soft" className="mt-4">
                  <Link href="/campaigns?create=1">
                    Create campaign <ArrowRight />
                  </Link>
                </Button>
              </div>
            ) : (
              <TrendChart data={seriesQuery.data ?? []} color={activeMetric.color} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Channel mix</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Share of sends</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/analytics">
                Details <ArrowUpRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {channelsQuery.isLoading ? (
              <Skeleton className="mx-auto h-[220px] w-[220px] rounded-full" />
            ) : (
              <ChannelDonut data={donutData} total={donutTotal} />
            )}

            <div className="mt-2 space-y-2.5">
              {donutData.map((item) => {
                const row = channelRows.find((channel) => channelMeta(channel.channel).label === item.name);
                const share = donutTotal > 0 ? (item.value / donutTotal) * 100 : 0;
                return (
                  <div key={item.name} className="flex items-center gap-2.5 text-sm">
                    <span className="size-2 rounded-full" style={{ background: item.color }} />
                    <span className="flex-1 text-muted-foreground">{item.name}</span>
                    <span className="font-semibold">{formatCompact(item.value)}</span>
                    <span className="w-12 text-right text-xs text-muted-foreground">{share.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-2xl border border-border/70 bg-secondary/30 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Monthly usage</span>
                <Link href="/billing" className="text-violet-600 hover:underline dark:text-violet-300">
                  Manage
                </Link>
              </div>
              <div className="mt-3 space-y-2.5">
                {[
                  { label: "Email", value: overview?.usage?.email ?? 0, tone: "sky" as const },
                  { label: "WhatsApp", value: overview?.usage?.whatsapp ?? 0, tone: "emerald" as const },
                  { label: "SMS", value: overview?.usage?.sms ?? 0, tone: "amber" as const }
                ].map((usage) => {
                  const max = Math.max(
                    overview?.usage?.email ?? 0,
                    overview?.usage?.whatsapp ?? 0,
                    overview?.usage?.sms ?? 0,
                    1
                  );
                  return (
                    <div key={usage.label} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">{usage.label}</span>
                        <span className="font-semibold">{formatNumber(usage.value)}</span>
                      </div>
                      <Progress value={usage.value} max={max} tone={usage.tone} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Recent campaigns</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">The latest broadcasts and automations.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/campaigns">
                View all <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {campaignsQuery.isLoading ? (
              <div className="space-y-3 px-6">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : campaignsQuery.isError ? (
              <div className="px-6 pb-4">
                <ErrorState title="Campaigns unavailable" message="We couldn't load recent campaigns." onRetry={() => void campaignsQuery.refetch()} />
              </div>
            ) : campaigns.length === 0 ? (
              <EmptyState
                icon={Megaphone}
                title="No campaigns yet"
                description="Create your first broadcast to see performance land here."
                action={
                  <Button asChild variant="gradient" size="sm">
                    <Link href="/campaigns?create=1">
                      <Plus /> New campaign
                    </Link>
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-border/60 dark:divide-white/[0.06]">
                {campaigns.map((campaign) => {
                  const total = campaign.stats?.totalRecipients ?? 0;
                  const sent = (campaign.stats?.sent ?? 0) + (campaign.stats?.delivered ?? 0);
                  return (
                    <Link
                      key={campaign.id}
                      href={`/campaigns/${campaign.id}`}
                      className="flex items-center gap-3.5 px-6 py-3.5 transition-colors hover:bg-violet-50/50 dark:hover:bg-white/[0.03]"
                    >
                      <ChannelIcon channel={campaign.channel} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{campaign.name}</p>
                          <StatusBadge status={campaign.status} />
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <ChannelBadge channel={campaign.channel} className="px-1.5 py-0 text-[10px]" />
                          <span>{formatDate(campaign.createdAt)}</span>
                          {total > 0 ? (
                            <>
                              <span className="text-border">•</span>
                              <span>
                                {formatCompact(sent)} / {formatCompact(total)} sent
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="hidden w-28 sm:block">
                        <Progress value={total > 0 ? (sent / total) * 100 : 0} className="h-1.5" />
                      </div>
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/50" />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Inbox snapshot</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Open conversations</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/inbox">
                Open <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {conversationsQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : conversationsQuery.isError ? (
              <ErrorState title="Inbox unavailable" message="We couldn't load conversations." onRetry={() => void conversationsQuery.refetch()} />
            ) : conversations.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="Inbox zero"
                description="When contacts reply on any channel, the conversation will appear here."
                className="py-10"
              />
            ) : (
              <div className="space-y-1.5">
                {conversations.map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={`/inbox?conversation=${conversation.id}`}
                    className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-violet-50/60 dark:hover:bg-white/[0.04]"
                  >
                    <Avatar className="size-9">
                      <AvatarFallback className="text-[10px]">
                        {initials(conversation.contactName ?? "Contact")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold">{conversation.contactName ?? "Contact"}</p>
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                          {formatDate(conversation.lastMessageAt, "MMM d")}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {truncate(conversation.lastMessagePreview ?? "Open conversation", 46)}
                      </p>
                    </div>
                    {conversation.unreadCount > 0 ? (
                      <Badge variant="gradient" className="size-5 justify-center rounded-full p-0 text-[10px]">
                        {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                      </Badge>
                    ) : (
                      <ChannelBadge channel={conversation.channel} className="shrink-0 px-1.5 py-0 text-[10px]" />
                    )}
                  </Link>
                ))}
              </div>
            )}
            <Button asChild variant="soft" size="sm" className="mt-3 w-full">
              <Link href="/inbox">
                <Sparkles /> Go to inbox
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
