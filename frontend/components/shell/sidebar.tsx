"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, LogOut, X, Zap } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { WorkspaceSwitcher } from "@/components/shell/workspace-switcher";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { isActivePath, navigation } from "@/lib/navigation";
import { cn } from "@/lib/cn";
import { displayName, initials } from "@/lib/format";

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname() ?? "";
  const { user, currentOrganization, logout } = useWorkspace();

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-[#07030f]/60 backdrop-blur-sm transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[276px] flex-col overflow-hidden bg-[#0a0618] text-white transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-24 size-64 rounded-full bg-violet-600/25 blur-[90px]" />
          <div className="absolute -right-24 top-1/3 size-56 rounded-full bg-fuchsia-600/15 blur-[90px]" />
          <div className="absolute -bottom-24 left-0 size-64 rounded-full bg-teal-500/10 blur-[90px]" />
          <div className="absolute inset-0 bg-grid-fade bg-[length:40px_40px] opacity-[0.35]" />
        </div>

        <div className="relative flex items-center justify-between px-5 pb-4 pt-5">
          <Logo onDark />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="relative px-3 pb-4">
          <WorkspaceSwitcher variant="dark" />
        </div>

        <nav className="relative flex-1 space-y-6 overflow-y-auto px-3 pb-4 no-scrollbar">
          {navigation.map((section) => (
            <div key={section.label} className="space-y-1">
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">{section.label}</p>
              {section.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn("sidebar-link", active && "sidebar-link-active")}
                  >
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg transition-all",
                        active
                          ? "bg-brand-gradient text-white shadow-[0_6px_16px_-6px_rgba(217,70,239,0.9)]"
                          : "bg-white/[0.04] text-white/50 group-hover:text-white"
                      )}
                    >
                      <Icon className="size-[17px]" />
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-full bg-brand-gradient px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="relative px-3 pb-3">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-violet-600/25 via-fuchsia-600/15 to-amber-500/10 p-4">
            <div className="absolute -right-6 -top-6 size-20 rounded-full bg-fuchsia-400/25 blur-2xl" />
            <div className="relative">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                <Zap className="size-3" /> Grow faster
              </span>
              <p className="mt-2 font-display text-sm font-semibold text-white">Unlock every channel</p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/55">
                Upgrade for unlimited automations and deeper analytics.
              </p>
              <Button asChild size="sm" variant="gradient" className="mt-3 h-8 w-full rounded-lg text-xs">
                <Link href="/billing">
                  View plans <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="relative flex items-center gap-2.5 border-t border-white/10 px-4 py-3.5">
          <Avatar className="size-9">
            <AvatarFallback>{initials(displayName(user))}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{displayName(user)}</p>
            <p className="truncate text-[11px] text-white/45">{user?.email ?? currentOrganization?.name ?? "comGpt"}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
