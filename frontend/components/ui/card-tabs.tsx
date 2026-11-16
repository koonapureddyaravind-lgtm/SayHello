"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface CardTabsProps {
  tabs: { value: string; label: string; count?: number }[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function CardTabs({ tabs, value, onValueChange, className }: CardTabsProps) {
  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto rounded-xl bg-secondary/60 p-1 no-scrollbar dark:bg-white/[0.05]", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onValueChange(tab.value)}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
            value === tab.value
              ? "bg-card text-foreground shadow-sm dark:bg-white/[0.1]"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                value === tab.value ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200" : "bg-transparent"
              )}
            >
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
