"use client";

import { Building2, Check, ChevronsUpDown, Plus, Sparkles } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, titleCase } from "@/lib/format";
import { cn } from "@/lib/cn";

export function WorkspaceSwitcher({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { currentOrganization, organizations, switchOrganization, isLoading } = useWorkspace();
  const dark = variant === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-2xl border px-2.5 py-2 text-left transition-colors",
            dark
              ? "border-white/10 bg-white/[0.05] hover:bg-white/[0.09]"
              : "border-border/70 bg-card/70 hover:bg-secondary/60 dark:border-white/10 dark:bg-white/[0.04]"
          )}
          disabled={isLoading}
        >
          <Avatar className="size-8" gradient>
            <AvatarFallback className="text-[10px]">{initials(currentOrganization?.name ?? "comGpt")}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-sm font-semibold", dark ? "text-white" : "text-foreground")}>
              {currentOrganization?.name ?? "Select workspace"}
            </span>
            <span className={cn("block truncate text-[11px]", dark ? "text-white/45" : "text-muted-foreground")}>
              {currentOrganization?.role ? titleCase(currentOrganization.role) : "Workspace"}
            </span>
          </span>
          <ChevronsUpDown className={cn("size-4 shrink-0", dark ? "text-white/40" : "text-muted-foreground")} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => {
              if (org.id !== currentOrganization?.id) void switchOrganization(org.id);
            }}
            className="gap-2.5 py-2.5"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-gradient-soft text-violet-600 dark:text-violet-300">
              <Building2 className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{org.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{titleCase(org.role ?? org.type ?? "")}</span>
            </span>
            {org.id === currentOrganization?.id ? <Check className="size-4 text-violet-500" /> : null}
          </DropdownMenuItem>
        ))}
        {organizations.length === 0 ? (
          <DropdownMenuItem disabled>No workspaces yet</DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/settings?tab=workspace">
            <Sparkles className="text-violet-500" /> Workspace settings
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/settings?tab=workspace&create=1">
            <Plus /> Create workspace
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <Button asChild variant="outline" size="sm" className="w-full">
            <a href="/team">Manage team</a>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
