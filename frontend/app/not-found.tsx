import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center aurora-layer px-6">
      <div className="w-full max-w-md rounded-[28px] border border-border/70 bg-card/85 p-8 text-center shadow-float backdrop-blur-xl">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
          <Compass className="size-7" />
        </div>
        <p className="mt-6 font-display text-6xl font-semibold tracking-tight gradient-text">404</p>
        <h1 className="mt-2 font-display text-xl font-semibold">This page drifted away</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link may be outdated or the workspace item was removed. Let&apos;s get you back on track.
        </p>
        <Button asChild variant="gradient" className="mt-6">
          <Link href="/dashboard">
            <Home /> Back to dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
