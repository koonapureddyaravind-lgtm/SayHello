"use client";

import { useQuery } from "@tanstack/react-query";
import { History, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, truncate } from "@/lib/format";
import type { TemplateVersion } from "@/lib/types";

export function TemplateVersionsList({
  templateId,
  enabled = true,
  limit,
  className
}: {
  templateId: string;
  enabled?: boolean;
  limit?: number;
  className?: string;
}) {
  const versionsQuery = useQuery({
    queryKey: ["templates", "versions", templateId],
    queryFn: () => apiFetch<TemplateVersion[]>(`/templates/${templateId}/versions`),
    enabled: enabled && Boolean(templateId)
  });

  const versions = versionsQuery.data ?? [];
  const visible = typeof limit === "number" ? versions.slice(0, limit) : versions;

  if (versionsQuery.isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (versionsQuery.isError) {
    return (
      <div className={cn("rounded-2xl border border-rose-200/70 bg-rose-50/60 p-3 dark:border-rose-400/20 dark:bg-rose-500/10", className)}>
        <p className="text-xs font-medium text-rose-700 dark:text-rose-200">Couldn&apos;t load versions.</p>
        <Button variant="ghost" size="sm" className="mt-1.5" onClick={() => void versionsQuery.refetch()}>
          <RefreshCw /> Retry
        </Button>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center dark:border-white/[0.08]",
          className
        )}
      >
        <History className="mb-2 size-5 text-violet-400" />
        <p className="text-xs font-semibold">No versions yet</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">Published changes will appear here.</p>
      </div>
    );
  }

  return (
    <ul className={cn("space-y-2", className)}>
      {visible.map((version) => (
        <li
          key={version.id}
          className="rounded-2xl border border-border/70 bg-card/60 p-3 transition-colors hover:border-violet-300/60 dark:border-white/[0.08] dark:bg-white/[0.02]"
        >
          <div className="flex items-center justify-between gap-2">
            <Badge variant="purple" className="text-[10px]">
              v{version.version}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{formatDateTime(version.createdAt)}</span>
          </div>
          {version.subject?.trim() ? (
            <p className="mt-1.5 truncate text-xs font-semibold">{version.subject}</p>
          ) : null}
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
            {truncate(version.body, 140)}
          </p>
          {version.createdBy ? (
            <p className="mt-1.5 text-[10px] text-muted-foreground">by {version.createdBy}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
