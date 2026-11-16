"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { ApiClientError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Unable to sign in with those credentials.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Check that the API is running and try again.");
    } finally {
      setLoading(false);
    }
  }

  function useDemo() {
    setEmail("owner@omniflow.local");
    setPassword("OmniFlow123!");
    setError(null);
  }

  return (
    <AuthShell>
      <div className="animate-fade-up">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/60 bg-violet-50/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-200">
          <Sparkles className="size-3" /> Welcome back
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">Sign in to comGpt</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick up where you left off — your campaigns, inbox and automations are waiting.
        </p>

        {error ? (
          <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-rose-200/70 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              leftIcon={<Mail />}
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <span className="text-xs font-medium text-muted-foreground">At least 8 characters</span>
            </div>
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              leftIcon={<LockKeyhole />}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
              required
            />
          </div>

          <Button type="submit" variant="gradient" size="lg" className="w-full" loading={loading}>
            Sign in <ArrowRight />
          </Button>
        </form>

        <button
          type="button"
          onClick={useDemo}
          className="mt-3 w-full rounded-2xl border border-dashed border-violet-300/70 bg-violet-50/40 px-4 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:border-violet-400 hover:bg-violet-50 dark:border-violet-400/25 dark:bg-violet-500/[0.06] dark:hover:bg-violet-500/10"
        >
          <span className="font-semibold text-violet-700 dark:text-violet-300">Try the demo workspace</span> — fills{" "}
          <span className="font-mono text-[11px]">owner@omniflow.local</span> with the seeded password.
        </button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to comGpt?{" "}
          <Link href="/register" className="font-semibold text-violet-600 hover:underline dark:text-violet-300">
            Create your workspace
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
