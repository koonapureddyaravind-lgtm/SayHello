"use client";

import { Mail, MessageCircle, Smartphone, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/error-state";
import { formatMicros, formatNumber } from "@/lib/format";
import type { UsageSummary } from "@/lib/types";

interface MetricConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: "sky" | "emerald" | "amber";
  iconClass: string;
}

const METRIC_CONFIG: MetricConfig[] = [
  {
    key: "EMAIL_SENT",
    label: "Email",
    icon: Mail,
    tone: "sky",
    iconClass: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"
  },
  {
    key: "WHATSAPP_SENT",
    label: "WhatsApp",
    icon: MessageCircle,
    tone: "emerald",
    iconClass: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
  },
  {
    key: "SMS_SENT",
    label: "SMS",
    icon: Smartphone,
    tone: "amber",
    iconClass: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
  }
];

export function UsageCard({
  usage,
  period,
  periods,
  onPeriodChange,
  isLoading,
  isError,
  onRetry
}: {
  usage?: UsageSummary;
  period: string;
  periods: { value: string; label: string }[];
  onPeriodChange: (period: string) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const lines = usage?.metrics ?? [];
  const totalUsed = lines.reduce((sum, line) => sum + (line.used ?? 0), 0);
  const totalCost = lines.reduce((sum, line) => sum + (line.costMicros ?? 0), 0);
  const periodLabel = periods.find((option) => option.value === period)?.label ?? period;

  return (
    <Card id="usage" className="scroll-mt-24">
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Usage</CardTitle>
            {usage?.planCode ? (
              <Badge variant="outline" className="uppercase tracking-wider">
                {usage.planCode}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Consumption against your monthly allowances.</p>
        </div>
        <Select value={period} onValueChange={onPeriodChange}>
          <SelectTrigger className="h-9 w-full sm:w-[160px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {periods.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
            <Skeleton className="h-20 w-full" />
          </div>
        ) : isError ? (
          <ErrorState
            title="Usage unavailable"
            message="We couldn't load usage for this period."
            onRetry={onRetry}
          />
        ) : (
          <>
            <div className="space-y-4">
              {METRIC_CONFIG.map((config) => {
                const line = lines.find((item) => item.metric === config.key);
                const used = line?.used ?? 0;
                const included = line?.included ?? 0;
                const overage = line?.overage ?? 0;
                const cost = line?.costMicros ?? 0;
                const percent = included > 0 ? Math.min(100, (used / included) * 100) : used > 0 ? 100 : 0;
                const Icon = config.icon;

                return (
                  <div key={config.key} className="space-y-2">
                    <div className="flex items-start gap-2.5">
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${config.iconClass}`}>
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                          <span className="text-sm font-semibold">{config.label}</span>
                          <span className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">{formatNumber(used)}</span> used
                            {included > 0 ? ` / ${formatNumber(included)} included` : " · no included allowance"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {overage > 0 ? (
                            <>
                              <span className="font-medium text-rose-600 dark:text-rose-300">
                                {formatNumber(overage)} overage
                              </span>{" "}
                              · {formatMicros(cost)}
                            </>
                          ) : (
                            "Within allowance"
                          )}
                        </p>
                      </div>
                    </div>
                    <Progress value={percent} tone={config.tone} className="h-1.5" />
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/60 bg-gradient-to-br from-violet-50/80 via-fuchsia-50/40 to-transparent p-4 dark:border-white/[0.06] dark:from-violet-500/[0.08] dark:via-fuchsia-500/[0.04]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Total sends
                </p>
                <p className="mt-1 font-display text-xl font-semibold">{formatNumber(totalUsed)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Estimated overage
                </p>
                <p className="mt-1 font-display text-xl font-semibold">{formatMicros(totalCost)}</p>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {lines.length === 0
                ? "No usage has been recorded for this period."
                : `Usage for ${periodLabel}. Included allowances reset each billing period; overage is billed at your plan rates.`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
