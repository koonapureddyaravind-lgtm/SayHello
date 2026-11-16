"use client";

import type { LucideIcon } from "lucide-react";
import { Building2, Check, Crown, Rocket, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  includedLabel,
  overagePerThousand,
  planFeatureList
} from "@/components/features/billing/billing-utils";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Plan } from "@/lib/types";

interface Accent {
  bar: string;
  icon: string;
  orb: string;
  iconComponent: LucideIcon;
}

const ACCENTS: Record<string, Accent> = {
  STARTER: {
    bar: "from-sky-500 via-blue-500 to-indigo-500",
    icon: "from-sky-500 to-blue-600 shadow-sky-500/40",
    orb: "bg-sky-400/20",
    iconComponent: Sparkles
  },
  GROWTH: {
    bar: "from-violet-500 via-fuchsia-500 to-pink-500",
    icon: "from-violet-500 to-fuchsia-600 shadow-fuchsia-500/40",
    orb: "bg-fuchsia-400/20",
    iconComponent: Rocket
  },
  AGENCY: {
    bar: "from-emerald-500 via-teal-500 to-cyan-500",
    icon: "from-emerald-500 to-teal-600 shadow-emerald-500/40",
    orb: "bg-emerald-400/20",
    iconComponent: Building2
  },
  ENTERPRISE: {
    bar: "from-amber-400 via-orange-500 to-rose-500",
    icon: "from-amber-400 to-orange-600 shadow-amber-500/40",
    orb: "bg-amber-400/20",
    iconComponent: Crown
  }
};

const FALLBACK: Accent = {
  bar: "from-violet-500 via-fuchsia-500 to-orange-400",
  icon: "from-violet-500 to-fuchsia-600 shadow-violet-500/40",
  orb: "bg-violet-400/20",
  iconComponent: Sparkles
};

const CHANNEL_INCLUDED = [
  { key: "includedEmails", label: "Email", dot: "bg-sky-500" },
  { key: "includedWhatsapp", label: "WhatsApp", dot: "bg-emerald-500" },
  { key: "includedSms", label: "SMS", dot: "bg-amber-500" }
] as const;

const OVERAGE_ROWS = [
  { key: "overageEmailMicros", label: "Email" },
  { key: "overageWhatsappMicros", label: "WhatsApp" },
  { key: "overageSmsMicros", label: "SMS" }
] as const;

export function PlanCard({
  plan,
  isCurrent,
  disabled,
  onChoose
}: {
  plan: Plan;
  isCurrent: boolean;
  disabled?: boolean;
  onChoose: (plan: Plan) => void;
}) {
  const accent = ACCENTS[plan.code] ?? FALLBACK;
  const Icon = accent.iconComponent;
  const features = planFeatureList(plan.features);
  const isCustom = plan.priceMonthlyCents <= 0;

  return (
    <Card
      interactive
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-3xl",
        isCurrent && "border-violet-300/70 shadow-float ring-2 ring-violet-400/30 dark:border-violet-400/40"
      )}
    >
      <div className={cn("h-1.5 w-full shrink-0 bg-gradient-to-r", accent.bar)} />
      <div className={cn("pointer-events-none absolute -right-10 -top-12 size-36 rounded-full blur-3xl", accent.orb)} />
      <CardHeader className="relative pb-4">
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              "flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg",
              accent.icon
            )}
          >
            <Icon className="size-5" />
          </div>
          {isCurrent ? (
            <Badge variant="gradient" className="gap-1">
              <Sparkles /> Current
            </Badge>
          ) : plan.code === "GROWTH" ? (
            <Badge variant="purple">Popular</Badge>
          ) : (
            <Badge variant="outline" className="uppercase tracking-wider">
              {plan.code}
            </Badge>
          )}
        </div>
        <CardTitle className="mt-4 text-xl">{plan.name}</CardTitle>
        <p className="min-h-[40px] text-sm leading-relaxed text-muted-foreground">
          {plan.description ?? "A plan tailored to your sending volume."}
        </p>
        <div className="flex items-baseline gap-1.5 pt-1">
          <span className="font-display text-3xl font-semibold tracking-tight">
            {isCustom ? "Custom" : formatCurrency(plan.priceMonthlyCents, plan.currency)}
          </span>
          {!isCustom ? <span className="text-xs font-medium text-muted-foreground">/month</span> : null}
        </div>
      </CardHeader>

      <CardContent className="relative flex flex-1 flex-col gap-5">
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Included / month
          </p>
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border/60 bg-secondary/30 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
            {CHANNEL_INCLUDED.map((channel) => (
              <div key={channel.key}>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className={cn("size-1.5 rounded-full", channel.dot)} />
                  {channel.label}
                </div>
                <p className="mt-1 font-display text-sm font-semibold">{includedLabel(plan[channel.key])}</p>
              </div>
            ))}
          </div>
        </div>

        {features.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {features.map((feature, index) => (
              <li key={`${feature.label}-${index}`} className="flex items-start gap-2">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <Check className="size-2.5" />
                </span>
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{feature.label}</span>
                  {feature.detail ? <span className="text-muted-foreground"> · {feature.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto space-y-3">
          <div className="rounded-2xl border border-border/60 bg-card/60 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Overage pricing
            </p>
            <div className="mt-2 space-y-1.5">
              {OVERAGE_ROWS.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-semibold">
                    {plan[row.key] > 0
                      ? `${overagePerThousand(plan[row.key], plan.currency)} / 1k`
                      : "Custom"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Button
            variant={isCurrent ? "secondary" : "gradient"}
            className="w-full"
            disabled={isCurrent || disabled}
            onClick={() => onChoose(plan)}
          >
            {isCurrent ? "Current plan" : "Choose plan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
