"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/error-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { InvoicesCard } from "@/components/features/billing/invoices-card";
import { PlanGrid } from "@/components/features/billing/plan-grid";
import { SubscriptionHero } from "@/components/features/billing/subscription-hero";
import { UsageCard } from "@/components/features/billing/usage-card";
import {
  buildPeriodOptions,
  currentPeriodValue,
  includedLabel
} from "@/components/features/billing/billing-utils";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Invoice, Plan, Subscription, UsageSummary } from "@/lib/types";

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = React.useState(currentPeriodValue);
  const [pendingPlan, setPendingPlan] = React.useState<Plan | null>(null);
  const periods = React.useMemo(() => buildPeriodOptions(6), []);

  const plansQuery = useQuery({
    queryKey: ["billing", "plans"],
    queryFn: () => apiFetch<Plan[]>("/billing/plans")
  });

  const subscriptionQuery = useQuery({
    queryKey: ["billing", "subscription"],
    queryFn: () => apiFetch<Subscription>("/billing/subscription")
  });

  const usageQuery = useQuery({
    queryKey: ["billing", "usage", period],
    queryFn: () => apiFetch<UsageSummary>("/billing/usage", { query: { period } })
  });

  const invoicesQuery = useQuery({
    queryKey: ["billing", "invoices"],
    queryFn: () => apiFetch<Invoice[]>("/billing/invoices")
  });

  const allPlans = plansQuery.data ?? [];
  const plans = allPlans
    .filter((plan) => plan.isPublic !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const subscription = subscriptionQuery.data;
  const currentPlan =
    allPlans.find((plan) => plan.id === subscription?.planId) ??
    allPlans.find((plan) => plan.code === subscription?.planCode);

  const changePlan = useMutation({
    mutationFn: (plan: Plan) =>
      apiFetch<Subscription>("/billing/subscription", {
        method: "POST",
        body: { planCode: plan.code }
      }),
    onSuccess: async (_data, plan) => {
      toast.success(`You're now on the ${plan.name} plan.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["billing", "subscription"] }),
        queryClient.invalidateQueries({ queryKey: ["billing", "usage"] })
      ]);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    }
  });

  const refreshing =
    plansQuery.isFetching || subscriptionQuery.isFetching || usageQuery.isFetching || invoicesQuery.isFetching;

  const refreshAll = React.useCallback(() => {
    void Promise.allSettled([
      plansQuery.refetch(),
      subscriptionQuery.refetch(),
      usageQuery.refetch(),
      invoicesQuery.refetch()
    ]);
  }, [plansQuery, subscriptionQuery, usageQuery, invoicesQuery]);

  const scrollTo = React.useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleConfirmChange = React.useCallback(async () => {
    if (!pendingPlan) return;
    try {
      await changePlan.mutateAsync(pendingPlan);
      setPendingPlan(null);
    } catch {
      // The mutation's onError already surfaces a toast.
    }
  }, [changePlan, pendingPlan]);

  const periodLabel =
    subscription?.currentPeriodStart && subscription?.currentPeriodEnd
      ? `${formatDate(subscription.currentPeriodStart)} – ${formatDate(subscription.currentPeriodEnd)}`
      : "Current period";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plan & usage"
        title="Billing"
        description="Manage your plan, monitor channel allowances and keep every invoice in one place."
        actions={
          <>
            <div className="hidden items-center gap-2 rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] sm:flex">
              <CalendarDays className="size-3.5" />
              {periodLabel}
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={refreshAll} loading={refreshing}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />

      {subscriptionQuery.isError ? (
        <ErrorState
          title="Subscription unavailable"
          message="We couldn't load your current subscription. Your plan is unchanged — try again in a moment."
          onRetry={() => void subscriptionQuery.refetch()}
        />
      ) : (
        <SubscriptionHero
          subscription={subscription}
          plan={currentPlan}
          isLoading={subscriptionQuery.isLoading}
          onChangePlan={() => scrollTo("plans")}
          onManageUsage={() => scrollTo("usage")}
        />
      )}

      <PlanGrid
        plans={plans}
        currentPlanId={currentPlan?.id ?? subscription?.planId}
        isLoading={plansQuery.isLoading}
        isError={plansQuery.isError}
        disabled={changePlan.isPending}
        onRetry={() => void plansQuery.refetch()}
        onChoose={setPendingPlan}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <UsageCard
          usage={usageQuery.data}
          period={period}
          periods={periods}
          onPeriodChange={setPeriod}
          isLoading={usageQuery.isLoading}
          isError={usageQuery.isError}
          onRetry={() => void usageQuery.refetch()}
        />
        <div className="xl:col-span-2">
          <InvoicesCard
            invoices={invoicesQuery.data}
            isLoading={invoicesQuery.isLoading}
            isError={invoicesQuery.isError}
            onRetry={() => void invoicesQuery.refetch()}
          />
        </div>
      </div>

      <ConfirmDialog
        open={pendingPlan !== null}
        onOpenChange={(open) => {
          if (!open && !changePlan.isPending) setPendingPlan(null);
        }}
        title={pendingPlan ? `Switch to ${pendingPlan.name}?` : "Switch plan?"}
        description="Your new billing period starts immediately. Usage allowances update right away and any existing overage is preserved on your invoices."
        confirmLabel={pendingPlan ? `Switch to ${pendingPlan.name}` : "Switch plan"}
        loading={changePlan.isPending}
        onConfirm={handleConfirmChange}
      >
        {pendingPlan ? (
          <div className="rounded-2xl border border-border/60 bg-secondary/30 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">New monthly total</span>
              <span className="font-display text-lg font-semibold">
                {pendingPlan.priceMonthlyCents > 0
                  ? formatCurrency(pendingPlan.priceMonthlyCents, pendingPlan.currency)
                  : "Custom"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-semibold">{includedLabel(pendingPlan.includedEmails)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">WhatsApp</p>
                <p className="font-semibold">{includedLabel(pendingPlan.includedWhatsapp)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">SMS</p>
                <p className="font-semibold">{includedLabel(pendingPlan.includedSms)}</p>
              </div>
            </div>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
