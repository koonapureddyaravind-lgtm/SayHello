"use client";

import { CircleCheck, CircleX, Gauge, Send, Users } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";
import { Progress } from "@/components/ui/progress";
import { formatNumber } from "@/lib/format";
import type { CampaignStats } from "@/lib/types";
import { normalizeCampaignStats } from "./campaign-utils";

export function CampaignStatsPanel({ stats, loading }: { stats?: CampaignStats | null; loading?: boolean }) {
  const normalized = normalizeCampaignStats(stats);
  const reachedHint = normalized.reached > 0 ? `${formatNumber(normalized.delivered)} delivered of ${formatNumber(normalized.reached)} reached` : "No sends recorded yet";

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard
        label="Recipients"
        value={normalized.totalRecipients}
        icon={Users}
        tone="violet"
        hint={`${formatNumber(normalized.pending + normalized.queued)} awaiting send`}
        loading={loading}
      />
      <StatCard
        label="Sent"
        value={normalized.sent}
        icon={Send}
        tone="sky"
        hint={`${formatNumber(normalized.queued)} queued`}
        loading={loading}
      />
      <StatCard
        label="Delivered"
        value={normalized.delivered}
        icon={CircleCheck}
        tone="emerald"
        hint={reachedHint}
        loading={loading}
      />
      <StatCard
        label="Failed"
        value={normalized.failed}
        icon={CircleX}
        tone="rose"
        hint={`${formatNumber(normalized.skipped)} skipped`}
        loading={loading}
      />
      <StatCard
        label="Delivery rate"
        value={`${normalized.deliveryRate.toFixed(1)}%`}
        icon={Gauge}
        tone="fuchsia"
        hint={normalized.hasStats ? "Derived from recipient states" : "Waiting for first send"}
        loading={loading}
      />
    </div>
  );
}

const STAGES = [
  { key: "delivered", label: "Delivered", tone: "emerald" as const, bar: "bg-emerald-500" },
  { key: "sent", label: "Sent", tone: "violet" as const, bar: "bg-violet-500" },
  { key: "queued", label: "Queued", tone: "sky" as const, bar: "bg-sky-500" },
  { key: "pending", label: "Pending", tone: "amber" as const, bar: "bg-amber-400" },
  { key: "failed", label: "Failed", tone: "rose" as const, bar: "bg-rose-500" },
  { key: "skipped", label: "Skipped", tone: "violet" as const, bar: "bg-slate-400" }
] as const;

export function DeliveryFunnel({ stats }: { stats?: CampaignStats | null }) {
  const normalized = normalizeCampaignStats(stats);
  const stages = STAGES.map((stage) => ({
    ...stage,
    value: normalized[stage.key]
  }));
  const denominator = Math.max(
    normalized.totalRecipients,
    normalized.pending + normalized.queued + normalized.sent + normalized.delivered + normalized.failed + normalized.skipped,
    1
  );
  const reachedPercent = (normalized.reached / denominator) * 100;

  return (
    <div className="rounded-3xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-sm font-semibold">Delivery funnel</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {normalized.hasStats
              ? `${formatNumber(normalized.reached)} of ${formatNumber(normalized.totalRecipients)} recipients reached`
              : "Recipient states will appear as the campaign starts sending."}
          </p>
        </div>
        <span className="rounded-full bg-secondary/70 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground dark:bg-white/[0.06]">
          {reachedPercent.toFixed(1)}% progressed
        </span>
      </div>

      {normalized.hasStats ? (
        <>
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-secondary dark:bg-white/[0.06]">
            {stages.map((stage) =>
              stage.value > 0 ? (
                <div
                  key={stage.key}
                  className={stage.bar}
                  style={{ width: `${Math.max(0, (stage.value / denominator) * 100)}%` }}
                  title={`${stage.label}: ${formatNumber(stage.value)}`}
                />
              ) : null
            )}
          </div>

          <div className="mt-5 grid gap-x-5 gap-y-3 sm:grid-cols-2">
            {stages.map((stage) => (
              <div key={stage.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className={`size-2 rounded-full ${stage.bar}`} />
                    {stage.label}
                  </span>
                  <span className="font-semibold">
                    {formatNumber(stage.value)}
                    <span className="ml-1 font-normal text-muted-foreground">
                      {denominator > 0 ? `${((stage.value / denominator) * 100).toFixed(0)}%` : "0%"}
                    </span>
                  </span>
                </div>
                <Progress value={stage.value} max={denominator} tone={stage.tone} className="h-1.5" />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 flex h-24 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 text-center dark:border-white/[0.08]">
          <Gauge className="mb-2 size-5 text-violet-400" />
          <p className="text-xs text-muted-foreground">No delivery data yet</p>
        </div>
      )}
    </div>
  );
}
