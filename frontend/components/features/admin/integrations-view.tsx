"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  Cable,
  FlaskConical,
  Mail,
  Pencil,
  Plus,
  Plug,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Webhook
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StatusBadge } from "@/components/common/status-badge";
import { CopyButton } from "@/components/common/copy-button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/format";
import type { Channel, PageResponse, ProviderAccount } from "@/lib/types";
import { useWorkspace } from "@/components/providers/workspace-provider";
import {
  CHANNEL_META,
  CHANNEL_ORDER,
  providerCode,
  providerLabel
} from "@/components/features/admin/admin-meta";
import { normalizeList } from "@/components/features/admin/admin-utils";
import { IntegrationDialog } from "@/components/features/admin/integration-dialog";

type IntegrationList = ProviderAccount[] | PageResponse<ProviderAccount>;

interface IntegrationTestResult {
  ok: boolean;
  message: string;
}

const WEBHOOKS: { channel: Channel; label: string; url: string; note: string }[] = [
  {
    channel: "WHATSAPP",
    label: "WhatsApp Cloud API",
    url: "/api/v1/webhooks/whatsapp",
    note: "Paste this callback URL in Meta, then subscribe to message status events."
  },
  {
    channel: "EMAIL",
    label: "Amazon SES notifications",
    url: "/api/v1/webhooks/email/ses",
    note: "Point the SES/SNS delivery notification endpoint at this URL."
  },
  {
    channel: "SMS",
    label: "SMS provider callbacks",
    url: "/api/v1/webhooks/sms/{provider}",
    note: "Replace {provider} with twilio, plivo or generic to match your route."
  }
];

function SummaryCard({
  channel,
  accounts,
  onSelect
}: {
  channel: Channel;
  accounts: ProviderAccount[];
  onSelect: () => void;
}) {
  const meta = CHANNEL_META[channel];
  const Icon = meta.icon;
  const providers = Array.from(new Set(accounts.map((account) => providerLabel(account.provider))));
  const defaults = accounts.filter((account) => account.isDefault).length;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "stat-sheen group relative overflow-hidden rounded-3xl border bg-card/80 p-5 text-left shadow-card backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-float dark:bg-white/[0.035]",
        meta.ring
      )}
    >
      <div className={cn("pointer-events-none absolute -right-8 -top-10 size-32 rounded-full blur-3xl transition-opacity group-hover:opacity-100", meta.orb)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className={cn("flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg", meta.gradient)}>
          <Icon className="size-5" />
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-semibold tracking-tight">{accounts.length}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {accounts.length === 1 ? "account" : "accounts"}
          </p>
        </div>
      </div>
      <p className={cn("relative mt-4 text-xs font-bold uppercase tracking-[0.16em]", meta.accent)}>{meta.label}</p>
      <p className="relative mt-1 truncate text-sm text-muted-foreground">
        {providers.length > 0 ? providers.join(" · ") : "No providers connected"}
      </p>
      <div className="relative mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary dark:bg-white/[0.07]">
          <div
            className={cn("h-full rounded-full bg-gradient-to-r", meta.gradient)}
            style={{ width: `${accounts.length === 0 ? 0 : Math.max(18, (defaults / Math.max(accounts.length, 1)) * 100)}%` }}
          />
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground">
          {defaults > 0 ? `${defaults} default` : accounts.length > 0 ? "Set a default" : "Add one"}
        </span>
      </div>
    </button>
  );
}

function IntegrationCard({
  account,
  onEdit,
  onDelete,
  onTest,
  testing
}: {
  account: ProviderAccount;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  testing: boolean;
}) {
  const meta = CHANNEL_META[account.channel];

  return (
    <Card interactive className="overflow-hidden">
      <div className={cn("h-1 w-full bg-gradient-to-r", meta.gradient)} />
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg",
              meta.gradient
            )}
            title={providerLabel(account.provider)}
          >
            <span className="px-1 text-center text-[9px] font-bold uppercase leading-tight tracking-wide">
              {providerCode(account.provider)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate font-display text-sm font-semibold">{account.name}</p>
              {account.isDefault ? (
                <Badge variant="gradient" className="px-2 py-0 text-[10px]">
                  Default
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Mail className="size-3 shrink-0" />
              {account.fromAddress || "No from address set"}
            </p>
          </div>
          <StatusBadge status={account.status} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Provider</p>
            <p className="mt-0.5 truncate text-xs font-semibold">{providerLabel(account.provider)}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Last verified</p>
            <p className="mt-0.5 truncate text-xs font-semibold" title={formatDate(account.lastVerifiedAt, "MMM d, yyyy 'at' HH:mm")}>
              {account.lastVerifiedAt ? formatRelative(account.lastVerifiedAt) : "Never"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-1 border-t border-border/60 pt-3 dark:border-white/[0.06]">
          <Button variant="soft" size="sm" className="rounded-lg" onClick={onTest} loading={testing}>
            <FlaskConical /> Test
          </Button>
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onEdit}>
            <Pencil /> Edit
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
            onClick={onDelete}
            aria-label={`Delete ${account.name}`}
          >
            <Trash2 />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IntegrationsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-40 rounded-3xl" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-52 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-3xl" />
    </div>
  );
}

export function IntegrationsView() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useWorkspace();
  const organizationId = currentOrganization?.id;

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProviderAccount | null>(null);
  const [initialChannel, setInitialChannel] = React.useState<Channel>("EMAIL");
  const [deleteTarget, setDeleteTarget] = React.useState<ProviderAccount | null>(null);

  const integrationsQuery = useQuery({
    queryKey: ["integrations", organizationId],
    queryFn: () => apiFetch<IntegrationList>("/integrations")
  });

  const integrations = React.useMemo(
    () => normalizeList<ProviderAccount>(integrationsQuery.data),
    [integrationsQuery.data]
  );

  const grouped = React.useMemo(() => {
    const buckets: Record<Channel, ProviderAccount[]> = { EMAIL: [], WHATSAPP: [], SMS: [] };
    for (const account of integrations) {
      if (buckets[account.channel]) buckets[account.channel].push(account);
    }
    return buckets;
  }, [integrations]);

  const testMutation = useMutation({
    mutationFn: (account: ProviderAccount) =>
      apiFetch<IntegrationTestResult>(`/integrations/${account.id}/test`, { method: "POST" }),
    onSuccess: (result, account) => {
      if (result?.ok) {
        toast.success("Connection verified", {
          description: result.message || `${account.name} passed the configuration check.`
        });
      } else {
        toast.error("Connection check failed", {
          description: result?.message || `${account.name} needs attention before it can send.`
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/integrations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Integration removed");
      setDeleteTarget(null);
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  function openCreate(channel: Channel = "EMAIL") {
    setEditing(null);
    setInitialChannel(channel);
    setDialogOpen(true);
  }

  function openEdit(account: ProviderAccount) {
    setEditing(account);
    setInitialChannel(account.channel);
    setDialogOpen(true);
  }

  function selectChannel(channel: Channel) {
    if (grouped[channel].length === 0) {
      openCreate(channel);
      return;
    }
    const section = document.getElementById(`channel-${channel.toLowerCase()}`);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Channels"
        title="Integrations"
        description="Connect your own email, WhatsApp and SMS providers so every send runs through infrastructure you control."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => void integrationsQuery.refetch()}
              loading={integrationsQuery.isFetching}
            >
              <RefreshCw /> Refresh
            </Button>
            <Button variant="gradient" onClick={() => openCreate()}>
              <Plus /> Add integration
            </Button>
          </>
        }
      />

      {integrationsQuery.isError ? (
        <ErrorState
          title="Integrations are unavailable"
          message={errorMessage(integrationsQuery.error)}
          onRetry={() => void integrationsQuery.refetch()}
        />
      ) : integrationsQuery.isLoading ? (
        <IntegrationsSkeleton />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {CHANNEL_ORDER.map((channel) => (
              <SummaryCard
                key={channel}
                channel={channel}
                accounts={grouped[channel]}
                onSelect={() => selectChannel(channel)}
              />
            ))}
          </div>

          {integrations.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={Plug}
                  title="No integrations connected yet"
                  description="Add your first provider account to start sending email, WhatsApp or SMS from your own infrastructure."
                  action={
                    <Button variant="gradient" onClick={() => openCreate()}>
                      <Plus /> Add integration
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            CHANNEL_ORDER.map((channel) => {
              const accounts = grouped[channel];
              if (accounts.length === 0) return null;
              const meta = CHANNEL_META[channel];
              const Icon = meta.icon;
              return (
                <section key={channel} id={`channel-${channel.toLowerCase()}`} className="scroll-mt-24 space-y-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={cn(
                        "flex size-9 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
                        meta.gradient
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-display text-lg font-semibold tracking-tight">{meta.label}</h2>
                      <p className="text-xs text-muted-foreground">
                        {accounts.length} {accounts.length === 1 ? "account" : "accounts"} connected
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="ml-auto" onClick={() => openCreate(channel)}>
                      <Plus /> Add {meta.label}
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {accounts.map((account) => (
                      <IntegrationCard
                        key={account.id}
                        account={account}
                        onEdit={() => openEdit(account)}
                        onDelete={() => setDeleteTarget(account)}
                        onTest={() => testMutation.mutate(account)}
                        testing={testMutation.isPending && testMutation.variables?.id === account.id}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-md">
                    <Webhook className="size-4" />
                  </span>
                  <div>
                    <CardTitle className="text-base">Channel setup notes</CardTitle>
                    <CardDescription>Provider callbacks and delivery receipts land on these URLs.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {WEBHOOKS.map((webhook) => {
                  const meta = CHANNEL_META[webhook.channel];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={webhook.url}
                      className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-secondary/20 p-3 sm:flex-row sm:items-center dark:border-white/[0.06] dark:bg-white/[0.02]"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <span
                          className={cn(
                            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
                            meta.gradient
                          )}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{webhook.label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{webhook.note}</p>
                          <code className="mt-1.5 inline-block max-w-full truncate rounded-md bg-[#0b0618] px-2 py-1 font-mono text-[11px] text-emerald-200/90">
                            {webhook.url}
                          </code>
                        </div>
                      </div>
                      <CopyButton value={webhook.url} label="Copy" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <div className="h-1 w-full bg-brand-gradient" />
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
                    <ShieldCheck className="size-4" />
                  </span>
                  <div>
                    <CardTitle className="text-base">Before you connect</CardTitle>
                    <CardDescription>Three habits that keep sending healthy.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  {
                    icon: Cable,
                    title: "Use a dedicated sender",
                    body: "A production subdomain or number keeps reputation issues away from the rest of your brand."
                  },
                  {
                    icon: FlaskConical,
                    title: "Test before launch",
                    body: "The test action verifies required fields, then records the last verified timestamp."
                  },
                  {
                    icon: ArrowRight,
                    title: "Set one default",
                    body: "Default accounts keep campaign sends predictable when no provider is chosen explicitly."
                  }
                ].map((tip) => {
                  const Icon = tip.icon;
                  return (
                    <div key={tip.title} className="flex gap-2.5">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                        <Icon className="size-3.5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{tip.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{tip.body}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <IntegrationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editing}
        initialChannel={initialChannel}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteTarget(null);
        }}
        title="Delete integration?"
        description="Campaigns using this account will fail until another provider is selected. This cannot be undone."
        confirmLabel="Delete integration"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      >
        {deleteTarget ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-secondary/30 p-3 dark:border-white/[0.07] dark:bg-white/[0.03]">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
                CHANNEL_META[deleteTarget.channel].gradient
              )}
            >
              <Plug className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{deleteTarget.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {CHANNEL_META[deleteTarget.channel].label} · {providerLabel(deleteTarget.provider)}
              </p>
            </div>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
