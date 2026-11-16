"use client";

import { Check, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import type { WorkflowNodeType } from "@/lib/types";
import type { StudioNode } from "./studio-types";
import { NODE_PALETTE } from "./workflow-meta";

export function NodePalette({
  nodes,
  onAdd,
  className
}: {
  nodes: StudioNode[];
  onAdd: (kind: WorkflowNodeType) => void;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "flex flex-col rounded-3xl border border-border/70 bg-card/80 p-3 shadow-card backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.035]",
        className
      )}
    >
      <div className="flex items-center justify-between px-1 pb-2.5">
        <div>
          <p className="font-display text-sm font-semibold tracking-tight">Node library</p>
          <p className="text-[11px] text-muted-foreground">Click a block to add it</p>
        </div>
        <span className="flex size-7 items-center justify-center rounded-lg bg-brand-gradient-soft text-violet-600 dark:text-violet-300">
          <Sparkles className="size-3.5" />
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar lg:flex-col lg:overflow-visible lg:pb-0">
        {NODE_PALETTE.map((meta) => {
          const Icon = meta.icon;
          const alreadyAdded = meta.kind === "trigger" || meta.kind === "end" ? nodes.some((node) => node.data.kind === meta.kind) : false;
          return (
            <button
              key={meta.kind}
              type="button"
              disabled={alreadyAdded}
              onClick={() => onAdd(meta.kind)}
              className={cn(
                "group relative flex min-w-[190px] items-center gap-2.5 rounded-2xl border border-border/60 bg-secondary/30 p-2.5 text-left transition-all duration-200 lg:min-w-0",
                alreadyAdded
                  ? "cursor-not-allowed opacity-55"
                  : "hover:-translate-y-0.5 hover:border-violet-300/70 hover:bg-violet-50/60 hover:shadow-soft dark:border-white/[0.06] dark:bg-white/[0.025] dark:hover:border-violet-400/30 dark:hover:bg-white/[0.06]"
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md transition-transform duration-200",
                  meta.gradient,
                  !alreadyAdded && "group-hover:scale-105 group-hover:rotate-3"
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{meta.label}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{meta.description}</span>
              </span>
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full",
                  alreadyAdded ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-white/70 text-muted-foreground dark:bg-white/10"
                )}
              >
                {alreadyAdded ? <Check className="size-3" /> : <Plus className="size-3" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 hidden rounded-2xl border border-dashed border-violet-200/70 bg-brand-gradient-soft p-3 lg:block dark:border-violet-400/20">
        <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-200">Build a branch</p>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          Drag from the bottom handle of a condition node to route True and False paths.
        </p>
      </div>
    </aside>
  );
}
