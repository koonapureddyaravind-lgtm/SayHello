"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CirclePause,
  CircleX,
  EllipsisVertical,
  ExternalLink,
  Pause,
  Rocket,
  Trash2,
  UsersRound
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ChannelBadge, ChannelIcon, channelMeta } from "@/components/common/channel-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatCompact, formatDate } from "@/lib/format";
import type { Campaign, CampaignStats } from "@/lib/types";
import {
  canCancelCampaign,
  canLaunchCampaign,
  canPauseCampaign,
  normalizeCampaignStats
} from "./campaign-utils";
import { useCampaignAction } from "./use-campaign-actions";

const TYPE_LABELS: Record<Campaign["type"], string> = {
  BROADCAST: "Broadcast",
  AUTOMATION: "Automation"
};

export function CampaignCard({ campaign, segmentName }: { campaign: Campaign; segmentName?: string }) {
  const meta = channelMeta(campaign.channel);
  const statsQuery = useQuery({
    queryKey: ["campaigns", "stats", campaign.id],
    queryFn: () => apiFetch<CampaignStats>(`/campaigns/${campaign.id}/stats`),
    enabled: !campaign.stats,
    staleTime: 30_000
  });
  const stats = normalizeCampaignStats(campaign.stats ?? statsQuery.data);
  const progress = stats.totalRecipients > 0 ? (stats.reached / stats.totalRecipients) * 100 : 0;
  const actionMutation = useCampaignAction();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  const launchable = canLaunchCampaign(campaign.status);
  const pausable = canPauseCampaign(campaign.status);
  const cancellable = canCancelCampaign(campaign.status);

  const isActionPending = (action: "launch" | "pause" | "cancel" | "delete") =>
    actionMutation.isPending && actionMutation.variables?.action === action;

  return (
    <>
      <Card interactive className="group flex h-full flex-col overflow-hidden">
        <div className={cn("h-1.5 w-full bg-gradient-to-r", meta.soft)} />

        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start gap-3">
            <ChannelIcon channel={campaign.channel} className="size-11 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <Link
                href={`/campaigns/${campaign.id}`}
                className="block truncate font-display text-base font-semibold tracking-tight transition-colors hover:text-violet-600 dark:hover:text-violet-300"
              >
                {campaign.name}
              </Link>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={campaign.status} />
                <ChannelBadge channel={campaign.channel} className="px-2 py-0 text-[10px]" />
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${campaign.name}`}>
                  <EllipsisVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>{TYPE_LABELS[campaign.type]}</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href={`/campaigns/${campaign.id}`}>
                    <ExternalLink /> Open campaign
                  </Link>
                </DropdownMenuItem>
                {launchable ? (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      actionMutation.mutate({ campaignId: campaign.id, action: "launch" });
                    }}
                  >
                    <Rocket className="text-violet-500" />{" "}
                    {campaign.status === "PAUSED" ? "Resume campaign" : "Launch now"}
                  </DropdownMenuItem>
                ) : null}
                {pausable ? (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      actionMutation.mutate({ campaignId: campaign.id, action: "pause" });
                    }}
                  >
                    <Pause className="text-amber-500" /> Pause campaign
                  </DropdownMenuItem>
                ) : null}
                {cancellable ? (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      setCancelOpen(true);
                    }}
                  >
                    <CircleX className="text-rose-500" /> Cancel campaign
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-muted-foreground">
            {campaign.description?.trim() || "No description added yet."}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {formatDate(campaign.createdAt)}
            </span>
            {segmentName ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <UsersRound className="size-3.5 shrink-0" />
                <span className="truncate">{segmentName}</span>
              </span>
            ) : null}
            {campaign.scheduledAt ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5" />
                {formatDate(campaign.scheduledAt, "MMM d, HH:mm")}
              </span>
            ) : null}
          </div>

          <div className="mt-auto space-y-1.5 pt-4">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-muted-foreground">Delivery progress</span>
              <span className="font-semibold">
                {statsQuery.isLoading ? "Loading…" : `${formatCompact(stats.reached)} / ${formatCompact(stats.totalRecipients)}`}
              </span>
            </div>
            <Progress
              value={progress}
              tone={
                campaign.channel === "EMAIL" ? "sky" : campaign.channel === "WHATSAPP" ? "emerald" : "amber"
              }
              className="h-1.5"
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3 dark:border-white/[0.06]">
            <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wide">
              {TYPE_LABELS[campaign.type]}
            </Badge>
            <Button asChild variant="soft" size="sm">
              <Link href={`/campaigns/${campaign.id}`}>
                Open <ArrowUpRight />
              </Link>
            </Button>
          </div>
        </div>
      </Card>

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
            await actionMutation.mutateAsync({ campaignId: campaign.id, action: "delete" });
            setDeleteOpen(false);
          } catch {
            // The mutation surfaces a toast with the server message.
          }
        }}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel “${campaign.name}”?`}
        description="Queued messages will stop sending. You can duplicate the campaign later to reuse its setup."
        confirmLabel="Cancel campaign"
        cancelLabel="Keep campaign"
        loading={isActionPending("cancel")}
        onConfirm={async () => {
          try {
            await actionMutation.mutateAsync({ campaignId: campaign.id, action: "cancel" });
            setCancelOpen(false);
          } catch {
            // The mutation surfaces a toast with the server message.
          }
        }}
      >
        <div className="flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-xs text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
          <CirclePause className="size-4 shrink-0" />
          In-flight deliveries may still arrive at carriers.
        </div>
      </ConfirmDialog>
    </>
  );
}
