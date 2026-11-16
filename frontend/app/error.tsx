"use client";

import Link from "next/link";
import { Home, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center aurora-layer px-6">
      <div className="w-full max-w-md rounded-[28px] border border-border/70 bg-card/85 p-8 text-center shadow-float backdrop-blur-xl">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
          <TriangleAlert className="size-7" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight">Something went sideways</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page hit an unexpected error. Your data is safe — try again or head back to the dashboard.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button variant="gradient" onClick={reset}>
            <Sparkles /> Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <Home /> Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
