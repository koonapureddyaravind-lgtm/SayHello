"use client";

import { ArrowRight, CalendarDays, ChartNoAxesCombined, Sparkles } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { includedLabel } from "@/components/features/billing/billing-utils";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Plan, Subscription } from "@/lib/types";

export function SubscriptionHero({
  subscription,
  plan,
  isLoading,
  onChangePlan,
  onManageUsage
}: {
  subscription?: Subscription;
  plan?: Plan;
  isLoading: boolean;
  onChangePlan: () => void;
  onManageUsage: () => void;
}) {
  const price = plan ? formatCurrency(plan.priceMonthlyCents, plan.currency) : "—";
  const trialing = subscription?.status === "TRIALING";

  return (
    <section className="relative overflow-hidden rounded-[30px] bg-[#0b0618] p-6 text-white shadow-float sm:p-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 -top-24 size-72 rounded-full bg-violet-600/40 blur-[100px]" />
        <div className="absolute right-1/4 top-1/2 size-64 rounded-full bg-fuchsia-600/25 blur-[100px]" />
        <div className="absolute -bottom-24 right-0 size-72 rounded-full bg-amber-500/15 blur-[100px]" />
        <div className="absolute inset-0 bg-grid-fade bg-[length:40px_40px] opacity-30" />
      </div>

      {isLoading ? (
        <div className="relative flex animate-pulse flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full max-w-xl space-y-4">
            <div className="h-6 w-40 rounded-full bg-white/10" />
            <div className="h-9 w-64 rounded-xl bg-white/10" />
            <div className="h-4 w-full max-w-md rounded-lg bg-white/[0.07]" />
            <div className="flex gap-2 pt-2">
              <div className="h-10 w-32 rounded-xl bg-white/10" />
              <div className="h-10 w-32 rounded-xl bg-white/[0.07]" />
            </div>
          </div>
          <div className="h-56 w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.05]" />
        </div>
      ) : (
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-white/70 backdrop-blur">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              Current subscription
            </span>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-[34px]">
                <span className="gradient-text">{subscription?.planName ?? plan?.name ?? "Your plan"}</span>
              </h2>
              {subscription?.planCode ? (
                <span className="rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/60">
                  {subscription.planCode}
                </span>
              ) : null}
              {subscription ? <StatusBadge status={subscription.status} /> : null}
            </div>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/55">
              {plan?.description ??
                "Your workspace subscription, renewal schedule and usage allowances live here."}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button variant="gradient" className="rounded-xl" onClick={onChangePlan}>
                Change plan <ArrowRight />
              </Button>
              <Button
                variant="outline"
                className="rounded-xl border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.12] hover:text-white dark:border-white/15 dark:bg-white/[0.06]"
                onClick={onManageUsage}
              >
                <ChartNoAxesCombined /> Manage usage
              </Button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] text-white/45">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                <CalendarDays className="size-3" />
                Renews {formatDate(subscription?.currentPeriodEnd)}
              </span>
              {trialing && subscription?.trialEndsAt ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-2.5 py-1 text-fuchsia-200">
                  <Sparkles className="size-3" />
                  Trial ends {formatDate(subscription.trialEndsAt)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                  Billed {formatDate(subscription?.currentPeriodStart)} – {formatDate(subscription?.currentPeriodEnd)}
                </span>
              )}
            </div>
          </div>

          <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Monthly total</p>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-display text-3xl font-semibold tracking-tight">{price}</span>
              {plan && plan.priceMonthlyCents > 0 ? <span className="text-xs text-white/45">/month</span> : null}
            </div>
            <div className="my-4 h-px bg-white/10" />
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-white/45">Status</dt>
                <dd className="font-medium">{subscription?.status ? subscription.status.replace("_", " ").toLowerCase() : "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-white/45">Period start</dt>
                <dd className="font-medium">{formatDate(subscription?.currentPeriodStart)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-white/45">Next renewal</dt>
                <dd className="font-medium">{formatDate(subscription?.currentPeriodEnd)}</dd>
              </div>
              {trialing && subscription?.trialEndsAt ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-white/45">Trial ends</dt>
                  <dd className="font-medium text-fuchsia-200">{formatDate(subscription.trialEndsAt)}</dd>
                </div>
              ) : null}
            </dl>
            {plan ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[11px] leading-relaxed text-white/50">
                <p className="font-semibold text-white/70">Included each month</p>
                <p className="mt-1">
                  {includedLabel(plan.includedEmails)} emails · {includedLabel(plan.includedWhatsapp)} WhatsApp ·{" "}
                  {includedLabel(plan.includedSms)} SMS
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
