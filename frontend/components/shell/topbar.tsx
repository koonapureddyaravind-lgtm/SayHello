"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import {
  Bell,
  ChevronDown,
  CreditCard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  UserRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { quickActions, navigation } from "@/lib/navigation";
import { displayName, initials, titleCase } from "@/lib/format";
import { cn } from "@/lib/cn";

function currentSection(pathname: string): string {
  for (const section of navigation) {
    for (const item of section.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return item.label;
    }
  }
  return "Dashboard";
}

export function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { user, currentOrganization, logout } = useWorkspace();
  const [search, setSearch] = React.useState("");

  const section = currentSection(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl dark:border-white/[0.06]">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenNav}
          className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </button>

        <div className="hidden min-w-0 shrink items-center gap-2 text-sm sm:flex">
          <span className="text-muted-foreground">{currentOrganization?.name ?? "Workspace"}</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="truncate font-semibold text-foreground">{section}</span>
        </div>

        <form
          className="ml-1 max-w-md flex-1 sm:ml-4"
          onSubmit={(event) => {
            event.preventDefault();
            router.push(search.trim() ? `/contacts?q=${encodeURIComponent(search.trim())}` : "/contacts");
          }}
        >
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search contacts, campaigns, anything…"
            leftIcon={<Search />}
            className="h-10 bg-secondary/50 dark:bg-white/[0.04]"
            rightSlot={
              <kbd className="hidden rounded-md border border-border/70 bg-card/80 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:block">
                ⌘K
              </kbd>
            }
            aria-label="Search"
          />
        </form>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="gradient" size="sm" className="hidden h-9 rounded-xl px-3 sm:inline-flex">
                <Plus /> Create
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Create new</DropdownMenuLabel>
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <DropdownMenuItem key={action.href} asChild>
                    <Link href={action.href}>
                      <Icon className="text-violet-500" /> {action.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative rounded-xl" aria-label="Notifications">
                <Bell className="size-[18px]" />
                <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-gradient-to-br from-fuchsia-500 to-rose-500 ring-2 ring-background" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between px-2.5 py-2">
                <span className="font-display text-sm font-semibold">Notifications</span>
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
                  0 new
                </span>
              </div>
              <DropdownMenuSeparator />
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-secondary">
                  <Bell className="size-4" />
                </div>
                You&apos;re all caught up. Activity from your campaigns and inbox will land here.
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeToggle className="hidden sm:inline-flex" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl p-1 pr-1.5 transition-colors hover:bg-secondary/70 dark:hover:bg-white/[0.06]"
                aria-label="Account menu"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="text-[10px]">{initials(displayName(user))}</AvatarFallback>
                </Avatar>
                <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-2.5 py-3">
                <p className="truncate font-display text-sm font-semibold">{displayName(user)}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="rounded-full bg-brand-gradient-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-200">
                    {titleCase(currentOrganization?.role ?? "Member")}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {currentOrganization?.name}
                  </span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings?tab=profile">
                  <UserRound /> Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/billing">
                  <CreditCard /> Billing
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => void logout()}>
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
