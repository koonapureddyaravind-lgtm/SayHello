"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, UsersRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StatusBadge } from "@/components/common/status-badge";
import { apiFetch } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import type { Contact, SegmentRule } from "@/lib/types";
import { crmKeys } from "@/components/features/crm/crm-keys";
import { ContactAvatar } from "@/components/features/crm/contact-visuals";

interface SegmentPreviewResult {
  count: number;
  sample: Contact[];
}

export function SegmentPreviewDialog({
  open,
  onOpenChange,
  name,
  rules,
  matchType
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name?: string;
  rules: SegmentRule[];
  matchType: "ALL" | "ANY";
}) {
  const previewQuery = useQuery({
    queryKey: crmKeys.segments.preview(matchType, rules),
    queryFn: () =>
      apiFetch<SegmentPreviewResult>("/segments/preview", {
        method: "POST",
        body: { rules, matchType }
      }),
    enabled: open
  });

  const result = previewQuery.data;
  const count = result?.count ?? 0;
  const sample = result?.sample ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{name ? `Preview · ${name}` : "Segment preview"}</DialogTitle>
          <DialogDescription>
            A live count of active contacts matching these rules. Nothing is saved until you create or update the
            segment.
          </DialogDescription>
        </DialogHeader>

        {previewQuery.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        ) : previewQuery.isError ? (
          <ErrorState
            title="Preview unavailable"
            message="We couldn't evaluate these rules. Check the operators and values, then try again."
            onRetry={() => void previewQuery.refetch()}
          />
        ) : (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-5 dark:border-violet-400/20 dark:from-violet-500/10 dark:via-white/[0.02] dark:to-fuchsia-500/10">
              <div className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-violet-400/20 blur-3xl" />
              <div className="relative flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">
                    Matching contacts
                  </p>
                  <p className="mt-1 font-display text-4xl font-semibold tracking-tight">
                    {formatNumber(count)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {rules.length === 0
                      ? "No rules yet — every active contact would match."
                      : `Evaluated against ${rules.length} ${rules.length === 1 ? "rule" : "rules"} · match ${matchType.toLowerCase()}`}
                  </p>
                </div>
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
                  <UsersRound className="size-5" />
                </span>
              </div>
            </div>

            {sample.length === 0 ? (
              <EmptyState
                icon={UsersRound}
                title="No contacts match yet"
                description="Loosen a rule or add more contacts. Active contacts only are evaluated."
                className="rounded-2xl border border-dashed border-border/70 py-10"
              />
            ) : (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Sample · first {sample.length} of {formatNumber(count)}
                </p>
                {sample.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-3 py-2.5 dark:bg-white/[0.02]"
                  >
                    <ContactAvatar contact={contact} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {[contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
                          contact.email ||
                          contact.phone ||
                          "Contact"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {contact.email ?? contact.phone ?? "No contact details"}
                      </p>
                    </div>
                    <StatusBadge status={contact.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => void previewQuery.refetch()}
            loading={previewQuery.isFetching}
          >
            <RefreshCw /> Refresh
          </Button>
          <Button type="button" variant="gradient" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
