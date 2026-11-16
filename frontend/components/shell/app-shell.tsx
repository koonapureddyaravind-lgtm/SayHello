"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { useWorkspace } from "@/components/providers/workspace-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = React.useState(false);
  const { isAuthenticated, isLoading } = useWorkspace();
  const router = useRouter();
  const [checked, setChecked] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace("/login");
      } else {
        setChecked(true);
      }
    }
  }, [isAuthenticated, isLoading, router]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center aurora-layer">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-gradient shadow-float">
            <Loader2 className="size-6 animate-spin text-white" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 aurora-layer" aria-hidden />
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="lg:pl-[276px]">
        <Topbar onOpenNav={() => setNavOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
