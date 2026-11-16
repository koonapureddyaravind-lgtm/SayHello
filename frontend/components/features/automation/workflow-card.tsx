"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  EllipsisVertical,
  ExternalLink,
  GitBranch,
  Layers,
  Pause,
  Play,
  Rocket,
  Tag,
  Trash2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/common/status-badge";
import { cn } from "@/lib/cn";
import { formatRelative, truncate } from "@/lib/format";
import type { Workflow } from "@/lib/types";
import { TRIGGER_META } from "./workflow-meta";

export type WorkflowAction = "activate" | "pause" | "delete";

export function WorkflowCard({
  workflow,
  onTest,
  onDelete,
  onToggleStatus,
  busyAction = null
}: {
  workflow: Workflow;
  onTest: (workflow: Workflow) => void;
  onDelete: (workflow: Workflow) => void;
  onToggleStatus: (workflow: Workflow, action: "activate" | "pause") => void;
  busyAction?: WorkflowAction | null;
}) {
  const trigger = TRIGGER_META[workflow.triggerType] ?? TRIGGER_META.MANUAL;
  const TriggerIcon = trigger.icon;
  const tagName =
    workflow.triggerType === "CONTACT_TAG_ADDED" && typeof workflow.triggerConfig?.tagName === "string"
      ? workflow.triggerConfig.tagName
      : "";
  const canActivate = workflow.status !== "ACTIVE" && workflow.status !== "ARCHIVED";
  const canPause = workflow.status === "ACTIVE";
  const canTest = workflow.currentVersion > 0;
  const busy = busyAction !== null;

  return (
    <Card interactive className="group flex h-full flex-col overflow-hidden">
      <div className={cn("h-1.5 w-full bg-gradient-to-r", trigger.gradient)} />

      <div className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-brand-gradient opacity-[0.07] blur-3xl transition-opacity duration-300 group-hover:opacity-[0.14]" />

      <div className="relative flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3",
              trigger.gradient
            )}
          >
            <TriggerIcon className="size-5" />
          </span>

          <div className="min-w-0 flex-1">
            <Link
              href={`/automation/${workflow.id}`}
              className="block truncate font-display text-base font-semibold tracking-tight transition-colors hover:text-violet-600 dark:hover:text-violet-300"
            >
              {workflow.name}
            </Link>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={workflow.status} />
              <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", trigger.chip)}>
                <TriggerIcon className="size-2.5" />
                {trigger.label}
              </span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${workflow.name}`}
                disabled={busy}
                className={cn(busy && "opacity-70")}
              >
                <EllipsisVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Workflow actions</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href={`/automation/${workflow.id}`}>
                  <ExternalLink /> Open studio
                </Link>
              </DropdownMenuItem>
              {canActivate ? (
                <DropdownMenuItem
                  disabled={workflow.currentVersion === 0}
                  onSelect={(event) => {
                    event.preventDefault();
                    onToggleStatus(workflow, "activate");
                  }}
                >
                  <Rocket className="text-violet-500" />
                  {workflow.currentVersion === 0 ? "Publish to activate" : "Activate workflow"}
                </DropdownMenuItem>
              ) : null}
              {canPause ? (
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    onToggleStatus(workflow, "pause");
                  }}
                >
                  <Pause className="text-amber-500" /> Pause workflow
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                disabled={!canTest}
                onSelect={(event) => {
                  event.preventDefault();
                  onTest(workflow);
                }}
              >
                <Play className="text-emerald-500" /> Test run
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => onDelete(workflow)}>
                <Trash2 /> Delete workflow
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-muted-foreground">
          {workflow.description?.trim() || "No description yet. Open the studio to map out this journey."}
        </p>

        {tagName ? (
          <div className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-secondary/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground dark:bg-white/[0.05]">
            <Tag className="size-3" /> Tag · {truncate(tagName, 28)}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Layers className="size-3.5" />
            {workflow.currentVersion > 0 ? `v${workflow.currentVersion} published` : "Not published"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-3.5" />
            Updated {formatRelative(workflow.updatedAt)}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3 dark:border-white/[0.06]">
          <Badge variant="secondary" className="max-w-[55%] truncate text-[10px] font-semibold uppercase tracking-wide">
            <GitBranch className="size-3" /> {workflow.currentVersion} version{workflow.currentVersion === 1 ? "" : "s"}
          </Badge>
          <Button asChild variant="soft" size="sm">
            <Link href={`/automation/${workflow.id}`}>
              Open studio <ArrowUpRight />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
