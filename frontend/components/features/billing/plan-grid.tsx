"use client";

import { Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PlanCard } from "@/components/features/billing/plan-card";
import type { Plan } from "@/lib/types";

export function PlanGrid({
  plans,
  currentPlanId,
  isLoading,
  isError,
  disabled,
  onRetry,
  onChoose
}: {
  plans: Plan[];
  currentPlanId?: string;
  isLoading: boolean;
  isError: boolean;
  disabled?: boolean;
  onRetry: () => void;
  onChoose: (plan: Plan) => void;
}) {
  return (
    <section id="plans" className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">Plans</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Scale your sending allowances as your audience grows. Switch any time.
          </p>
        </div>
        {!isLoading && !isError && plans.length > 0 ? (
          <Badge variant="secondary">{plans.length} plans available</Badge>
        ) : null}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[520px] w-full rounded-3xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Plans unavailable"
          message="We couldn't load the available plans. Try again in a moment."
          onRetry={onRetry}
        />
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No plans available"
          description="Public plans will appear here once they are published."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === currentPlanId}
              disabled={disabled}
              onChoose={onChoose}
            />
          ))}
        </div>
      )}
    </section>
  );
}
