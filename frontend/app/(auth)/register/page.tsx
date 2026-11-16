"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, Building2, Eye, EyeOff, LockKeyhole, Mail, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthShell } from "@/components/auth/auth-shell";

export default function RegisterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    fullName: "",
    organizationName: "",
    email: "",
    password: "",
    organizationType: "BUSINESS"
  });
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          organizationName: form.organizationName.trim(),
          organizationType: form.organizationType
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "We couldn't create your workspace. Check the details and try again.");
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

  return (
    <AuthShell>
      <div className="animate-fade-up">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-200/60 bg-fuchsia-50/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-fuchsia-700 dark:border-fuchsia-400/20 dark:bg-fuchsia-500/10 dark:text-fuchsia-200">
          <Sparkles className="size-3" /> Free plan included
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">Create your workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Launch your first omnichannel campaign in minutes. Start free — no credit card required.
        </p>

        {error ? (
          <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-rose-200/70 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Your name</Label>
              <Input
                id="fullName"
                autoComplete="name"
                placeholder="Alex Morgan"
                value={form.fullName}
                onChange={(event) => update("fullName", event.target.value)}
                leftIcon={<UserRound />}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="organizationName">Workspace</Label>
              <Input
                id="organizationName"
                autoComplete="organization"
                placeholder="Acme Growth"
                value={form.organizationName}
                onChange={(event) => update("organizationName", event.target.value)}
                leftIcon={<Building2 />}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              leftIcon={<Mail />}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="8+ characters"
                value={form.password}
                onChange={(event) => update("password", event.target.value)}
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
            <div className="space-y-1.5">
              <Label>Workspace type</Label>
              <Select value={form.organizationType} onValueChange={(value) => update("organizationType", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUSINESS">Business</SelectItem>
                  <SelectItem value="AGENCY">Agency</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" variant="gradient" size="lg" className="w-full" loading={loading}>
            Create workspace <ArrowRight />
          </Button>
        </form>

        <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
          By continuing you agree to comGpt&apos;s acceptable use policy. Consent and suppression are enforced per
          channel automatically.
        </p>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-violet-600 hover:underline dark:text-violet-300">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
