"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  CircleX,
  ExternalLink,
  FileText,
  Mail,
  Pause,
  Rocket,
  Trash2
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ChannelBadge, ChannelIcon, channelMeta } from "@/components/common/channel-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignStatsPanel, DeliveryFunnel } from "@/components/features/campaigns/campaign-stats-panel";
import { CampaignRecipients } from "@/components/features/campaigns/campaign-recipients";
import { CampaignScheduleDialog } from "@/components/features/campaigns/schedule-dialog";
import {
  canCancelCampaign,
  canLaunchCampaign,
  canPauseCampaign,
  campaignBody,
  campaignHtmlBody
} from "@/components/features/campaigns/campaign-utils";
import { useCampaignAction, type CampaignAction } from "@/components/features/campaigns/use-campaign-actions";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";
import type { Campaign, CampaignStats, PageResponse, Segment, Template } from "@/lib/types";

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 rounded-2xl border border-border/60 bg-secondary/20 px-3.5 py-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const campaignId = Array.isArray(rawId) ? rawId[0] ?? "" : rawId ?? "";
  const router = useRouter();

  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const campaignQuery = useQuery({
    queryKey: ["campaigns", "detail", campaignId],
    queryFn: () => apiFetch<Campaign>(`/campaigns/${campaignId}`),
    enabled: Boolean(campaignId)
  });

  const campaign = campaignQuery.data;

  const statsQuery = useQuery({
    queryKey: ["campaigns", "stats", campaignId],
    queryFn: () => apiFetch<CampaignStats>(`/campaigns/${campaignId}/stats`),
    enabled: Boolean(campaignId),
    refetchInterval: campaign?.status === "RUNNING" || campaign?.status === "QUEUED" ? 5000 : false
  });

  const segmentsQuery = useQuery({
    queryKey: ["segments", "options"],
    queryFn: () => apiFetch<PageResponse<Segment>>("/segments", { query: { page: 0, size: 100 } }),
    enabled: Boolean(campaign?.segmentId),
    staleTime: 60_000
  });

  const templatesQuery = useQuery({
    queryKey: ["templates", "options", "all"],
    queryFn: () => apiFetch<PageResponse<Template>>("/templates", { query: { page: 0, size: 100 } }),
    enabled: Boolean(campaign?.templateId),
    staleTime: 30_000
  });

  const actionMutation = useCampaignAction();

  const stats = statsQuery.data ?? campaign?.stats;
  const segment = segmentsQuery.data?.items.find((item) => item.id === campaign?.segmentId);
  const linkedTemplate = templatesQuery.data?.items.find((item) => item.id === campaign?.templateId);

  const body = campaign ? campaignBody(campaign) || linkedTemplate?.body || "" : "";
  const htmlBody = campaign ? campaignHtmlBody(campaign) || linkedTemplate?.htmlBody || "" : "";
  const subject = campaign?.subject || linkedTemplate?.subject || "";

  const isActionPending = (action: CampaignAction) =>
    actionMutation.isPending && actionMutation.variables?.action === action;

  if (!campaignId) {
    return (
      <EmptyState
        icon={FileText}
        title="Campaign not found"
        description="The campaign link is missing an identifier."
        action={
          <Button asChild variant="gradient">
            <Link href="/campaigns">
              <ArrowLeft /> Back to campaigns
            </Link>
          </Button>
        }
      />
    );
  }

  if (campaignQuery.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-44 w-full rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (campaignQuery.isError) {
    return (
      <div className="space-y-5">
        <Button asChild variant="ghost" size="sm">
          <Link href="/campaigns">
            <ArrowLeft /> Back to campaigns
          </Link>
        </Button>
        <ErrorState
          title="We couldn't open this campaign"
          message="The campaign may have been removed or you may not have access to it."
          onRetry={() => void campaignQuery.refetch()}
        />
      </div>
    );
  }

  if (!campaign) {
    return (
      <EmptyState
        icon={FileText}
        title="Campaign not found"
        description="This campaign doesn't exist anymore or the link is no longer valid."
        action={
          <Button asChild variant="gradient">
            <Link href="/campaigns">
              <ArrowLeft /> Back to campaigns
            </Link>
          </Button>
        }
      />
    );
  }

  const meta = channelMeta(campaign.channel);
  const launchable = canLaunchCampaign(campaign.status);
  const pausable = canPauseCampaign(campaign.status);
  const cancellable = canCancelCampaign(campaign.status);
  const hasContent = Boolean(body || htmlBody || subject);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link href="/campaigns">
          <ArrowLeft /> Back to campaigns
        </Link>
      </Button>

      <Card className="overflow-hidden">
        <div className={cn("h-1.5 w-full bg-gradient-to-r", meta.soft)} />
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <ChannelIcon channel={campaign.channel} className="size-14 rounded-2xl" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{campaign.name}</h1>
                  <StatusBadge status={campaign.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                  <ChannelBadge channel={campaign.channel} />
                  <span className="rounded-full bg-secondary/70 px-2 py-0.5 font-semibold text-foreground/80 dark:bg-white/[0.06]">
                    {campaign.type === "BROADCAST" ? "Broadcast" : "Automation"}
                  </span>
                  <span>Created {formatDate(campaign.createdAt)}</span>
                  {campaign.scheduledAt ? <span>Scheduled for {formatDateTime(campaign.scheduledAt)}</span> : null}
                </div>
                {campaign.description?.trim() ? (
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{campaign.description}</p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {launchable ? (
                <Button
                  variant="gradient"
                  onClick={() => actionMutation.mutate({ campaignId, action: "launch" })}
                  loading={isActionPending("launch")}
                >
                  <Rocket /> {campaign.status === "PAUSED" ? "Resume campaign" : "Launch now"}
                </Button>
              ) : null}
              {launchable ? (
                <Button variant="outline" onClick={() => setScheduleOpen(true)}>
                  <CalendarClock /> Schedule
                </Button>
              ) : null}
              {pausable ? (
                <Button
                  variant="outline"
                  onClick={() => actionMutation.mutate({ campaignId, action: "pause" })}
                  loading={isActionPending("pause")}
                >
                  <Pause /> Pause
                </Button>
              ) : null}
              {cancellable ? (
                <Button
                  variant="outline"
                  onClick={() => setCancelOpen(true)}
                  className="text-rose-600 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
                >
                  <CircleX /> Cancel
                </Button>
              ) : null}
              <Button
                variant="ghost"
                onClick={() => setDeleteOpen(true)}
                className="text-muted-foreground hover:text-rose-600 dark:hover:text-rose-300"
              >
                <Trash2 /> Delete
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {statsQuery.isError ? (
        <ErrorState
          title="Stats are taking a moment"
          message="Delivery numbers couldn't be refreshed. You can still review the campaign content and recipients."
          onRetry={() => void statsQuery.refetch()}
        />
      ) : null}

      <CampaignStatsPanel stats={stats} loading={statsQuery.isLoading && !campaign.stats} />

      <DeliveryFunnel stats={stats} />

      <Tabs defaultValue="recipients">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="recipients">Recipients</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="recipients">
          <CampaignRecipients campaignId={campaign.id} />
        </TabsContent>

        <TabsContent value="content">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
              <div>
                <CardTitle>Content</CardTitle>
                <CardDescription>The message your recipients receive.</CardDescription>
              </div>
              {linkedTemplate ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/templates/${linkedTemplate.id}`}>
                    <ExternalLink /> Open template
                  </Link>
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              {!hasContent ? (
                <EmptyState
                  icon={FileText}
                  title="No content attached yet"
                  description="Attach a template or edit this campaign to add the message body."
                  className="py-10"
                />
              ) : (
                <div className="space-y-4">
                  {linkedTemplate ? (
                    <p className="text-xs text-muted-foreground">
                      Content resolved from template <span className="font-semibold text-foreground">{linkedTemplate.name}</span>.
                    </p>
                  ) : null}

                  {subject ? (
                    <div className="rounded-2xl border border-border/70 bg-secondary/30 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Subject</p>
                      <p className="mt-1 text-sm font-semibold">{subject}</p>
                    </div>
                  ) : null}

                  {body ? (
                    <div className="rounded-2xl border border-border/70 bg-card/60 p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
                      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        <Mail className="size-3" /> Text body
                      </div>
                      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
                        {body}
                      </pre>
                    </div>
                  ) : null}

                  {htmlBody ? (
                    <div className="overflow-hidden rounded-2xl border border-border/70 bg-white dark:border-white/[0.08]">
                      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">HTML preview</span>
                        <span className="text-[10px] font-medium text-slate-400">Sandboxed</span>
                      </div>
                      <iframe
                        title={`${campaign.name} HTML content`}
                        sandbox=""
                        srcDoc={htmlBody}
                        className="h-[420px] w-full bg-white"
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Campaign details</CardTitle>
              <CardDescription>Audience, delivery settings and lifecycle timestamps.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <DetailItem label="Channel">
                  <ChannelBadge channel={campaign.channel} />
                </DetailItem>
                <DetailItem label="Type">{titleCase(campaign.type)}</DetailItem>
                <DetailItem label="Audience segment">
                  {campaign.segmentId ? segment?.name ?? "Loading segment…" : "All eligible contacts"}
                </DetailItem>
                <DetailItem label="Template">
                  {linkedTemplate ? (
                    <Link
                      href={`/templates/${linkedTemplate.id}`}
                      className="inline-flex items-center gap-1 text-violet-600 hover:underline dark:text-violet-300"
                    >
                      {linkedTemplate.name} <ExternalLink className="size-3" />
                    </Link>
                  ) : campaign.templateId ? (
                    "Loading template…"
                  ) : (
                    "No template attached"
                  )}
                </DetailItem>
                <DetailItem label="Sender name">{campaign.senderName?.trim() || "—"}</DetailItem>
                <DetailItem label="Sender address">{campaign.senderAddress?.trim() || "—"}</DetailItem>
                <DetailItem label="Scheduled at">{campaign.scheduledAt ? formatDateTime(campaign.scheduledAt) : "—"}</DetailItem>
                <DetailItem label="Started at">{campaign.startedAt ? formatDateTime(campaign.startedAt) : "—"}</DetailItem>
                <DetailItem label="Completed at">{campaign.completedAt ? formatDateTime(campaign.completedAt) : "—"}</DetailItem>
                <DetailItem label="Created">{formatDateTime(campaign.createdAt)}</DetailItem>
                <DetailItem label="Last updated">{formatDateTime(campaign.updatedAt)}</DetailItem>
                <DetailItem label="Campaign ID">
                  <span className="font-mono text-xs text-muted-foreground">{campaign.id}</span>
                </DetailItem>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CampaignScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} campaign={campaign} />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel “${campaign.name}”?`}
        description="Queued messages will stop sending. In-flight deliveries may still arrive at carriers."
        confirmLabel="Cancel campaign"
        cancelLabel="Keep campaign"
        loading={isActionPending("cancel")}
        onConfirm={async () => {
          try {
            await actionMutation.mutateAsync({ campaignId, action: "cancel" });
            setCancelOpen(false);
          } catch {
            // The mutation surfaces a toast with the server message.
          }
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete “${campaign.name}”?`}
        description="This removes the campaign and its recipient history. This action cannot be undone."
        confirmLabel="Delete campaign"
        destructive
        loading={isActionPending("delete")}
        onConfirm={async () => {
          try {
            await actionMutation.mutateAsync({ campaignId, action: "delete" });
            setDeleteOpen(false);
            router.push("/campaigns");
          } catch {
            // The mutation surfaces a toast with the server message.
          }
        }}
      />
    </div>
  );
}
