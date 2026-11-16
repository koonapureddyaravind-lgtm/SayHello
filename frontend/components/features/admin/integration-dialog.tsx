"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, Check, KeyRound, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { apiFetch, errorMessage } from "@/lib/api";
import type { Channel, ProviderAccount } from "@/lib/types";
import {
  CHANNEL_META,
  CHANNEL_ORDER,
  CONFIG_PRESETS,
  CREDENTIAL_PRESETS,
  PROVIDER_OPTIONS
} from "@/components/features/admin/admin-meta";
import { stringifyValue } from "@/components/features/admin/admin-utils";

interface KeyValueRow {
  id: string;
  key: string;
  value: string;
}

let rowSequence = 0;

function createRow(key = "", value = ""): KeyValueRow {
  rowSequence += 1;
  return { id: `kv-${rowSequence}`, key, value };
}

function KeyValueEditor({
  rows,
  onChange,
  secret,
  suggestions,
  addLabel,
  emptyLabel
}: {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  secret?: boolean;
  suggestions: string[];
  addLabel: string;
  emptyLabel: string;
}) {
  const present = new Set(rows.map((row) => row.key.trim()));
  const missing = suggestions.filter((key) => !present.has(key));

  function updateRow(id: string, patch: Partial<KeyValueRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    onChange(rows.filter((row) => row.id !== id));
  }

  function addRow(key = "") {
    onChange([...rows, createRow(key)]);
  }

  return (
    <div className="space-y-2.5">
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-secondary/30 px-3 py-2.5 text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <Input
                value={row.key}
                onChange={(event) => updateRow(row.id, { key: event.target.value })}
                placeholder="key"
                className="h-10 flex-1 font-mono text-xs"
                autoComplete="off"
                spellCheck={false}
                aria-label={secret ? "Credential key" : "Config key"}
              />
              <Input
                type={secret ? "password" : "text"}
                value={row.value}
                onChange={(event) => updateRow(row.id, { value: event.target.value })}
                placeholder={secret ? "••••••••" : "value"}
                className="h-10 flex-[1.4] font-mono text-xs"
                autoComplete={secret ? "new-password" : "off"}
                spellCheck={false}
                aria-label={secret ? "Credential value" : "Config value"}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:text-rose-600"
                onClick={() => removeRow(row.id)}
                aria-label="Remove field"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={() => addRow()}>
          <Plus /> {addLabel}
        </Button>
        {missing.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => addRow(key)}
            className="rounded-full border border-dashed border-violet-300/70 bg-violet-50/50 px-2.5 py-1 text-[11px] font-medium text-violet-700 transition-colors hover:border-violet-400 hover:bg-violet-100 dark:border-violet-400/25 dark:bg-violet-500/10 dark:text-violet-200 dark:hover:bg-violet-500/20"
          >
            + {key}
          </button>
        ))}
      </div>
    </div>
  );
}

export function IntegrationDialog({
  open,
  onOpenChange,
  account,
  initialChannel
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: ProviderAccount | null;
  initialChannel: Channel;
}) {
  const queryClient = useQueryClient();
  const [channel, setChannel] = React.useState<Channel>(initialChannel);
  const [provider, setProvider] = React.useState<string>(PROVIDER_OPTIONS[initialChannel][0].value);
  const [name, setName] = React.useState("");
  const [fromAddress, setFromAddress] = React.useState("");
  const [fromName, setFromName] = React.useState("");
  const [isDefault, setIsDefault] = React.useState(false);
  const [credentialRows, setCredentialRows] = React.useState<KeyValueRow[]>([]);
  const [configRows, setConfigRows] = React.useState<KeyValueRow[]>([]);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;

    const nextChannel = account?.channel ?? initialChannel;
    setChannel(nextChannel);
    setProvider(account?.provider ?? PROVIDER_OPTIONS[nextChannel][0].value);
    setName(account?.name ?? "");
    setFromAddress(account?.fromAddress ?? "");
    setFromName(account?.fromName ?? "");
    setIsDefault(account?.isDefault ?? false);
    setCredentialRows(account ? [] : CREDENTIAL_PRESETS[nextChannel].map((key) => createRow(key)));
    setConfigRows(
      account
        ? Object.entries(account.config ?? {}).map(([key, value]) => createRow(key, stringifyValue(value)))
        : CONFIG_PRESETS[nextChannel].map((key) => createRow(key))
    );
    setFormError(null);
  }, [open, account, initialChannel]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      account
        ? apiFetch<ProviderAccount>(`/integrations/${account.id}`, { method: "PATCH", body: payload })
        : apiFetch<ProviderAccount>("/integrations", { method: "POST", body: payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success(account ? "Integration updated" : "Integration connected", {
        description: account
          ? `${name.trim() || account.name} is ready with its new settings.`
          : `${name.trim()} is now available to campaigns.`
      });
      onOpenChange(false);
    },
    onError: (error) => setFormError(errorMessage(error))
  });

  function changeChannel(nextChannel: Channel) {
    setChannel(nextChannel);
    setProvider(PROVIDER_OPTIONS[nextChannel][0].value);
    if (!account) {
      setCredentialRows(CREDENTIAL_PRESETS[nextChannel].map((key) => createRow(key)));
      setConfigRows(CONFIG_PRESETS[nextChannel].map((key) => createRow(key)));
    }
  }

  function buildMap(rows: KeyValueRow[]): Record<string, string> {
    const entries: Record<string, string> = {};
    for (const row of rows) {
      const key = row.key.trim();
      const value = row.value.trim();
      if (key && value) entries[key] = value;
    }
    return entries;
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Give this account a name so your team can tell it apart.");
      return;
    }
    if (!provider) {
      setFormError("Choose a provider for this channel.");
      return;
    }

    const credentials = buildMap(credentialRows);
    const config = buildMap(configRows);
    const payload: Record<string, unknown> = {
      channel,
      provider,
      name: name.trim(),
      fromAddress: fromAddress.trim(),
      fromName: fromName.trim(),
      isDefault,
      config
    };

    // Never send an empty secret map on edit — that would wipe stored credentials.
    if (!account || Object.keys(credentials).length > 0) {
      payload.credentials = credentials;
    }

    saveMutation.mutate(payload);
  }

  const activeChannelMeta = CHANNEL_META[channel];

  return (
    <Dialog open={open} onOpenChange={(next) => (!saveMutation.isPending ? onOpenChange(next) : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account ? "Edit integration" : "Add integration"}</DialogTitle>
          <DialogDescription>
            {account
              ? "Update the sender details or rotate credentials. Stored secrets are never shown."
              : "Connect a provider account so campaigns can send through infrastructure you control."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label>Channel</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {CHANNEL_ORDER.map((value) => {
                const meta = CHANNEL_META[value];
                const Icon = meta.icon;
                const active = value === channel;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => changeChannel(value)}
                    className={cn(
                      "flex items-center gap-2 rounded-2xl border p-3 text-left transition-all",
                      active
                        ? cn("border-transparent bg-gradient-to-br text-white shadow-lg", meta.gradient)
                        : "border-border/70 bg-card/60 hover:border-violet-300/60 hover:bg-violet-50/40 dark:bg-white/[0.03] dark:hover:border-violet-400/30 dark:hover:bg-white/[0.06]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-xl",
                        active ? "bg-white/20" : "bg-secondary dark:bg-white/[0.06]"
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="text-sm font-semibold">{meta.label}</span>
                    {active ? <Check className="ml-auto size-4" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="integration-provider">Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger id="integration-provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS[channel].map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="integration-name">Account name</Label>
              <Input
                id="integration-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Primary sending account"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="integration-from-address">From address</Label>
              <Input
                id="integration-from-address"
                value={fromAddress}
                onChange={(event) => setFromAddress(event.target.value)}
                placeholder={
                  channel === "EMAIL" ? "you@company.com" : channel === "SMS" ? "+1 555 000 1234" : "+1 555 000 1234"
                }
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="integration-from-name">From name</Label>
              <Input
                id="integration-from-name"
                value={fromName}
                onChange={(event) => setFromName(event.target.value)}
                placeholder="e.g. comGpt Support"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-secondary/30 p-4 dark:border-white/[0.07] dark:bg-white/[0.03]">
            <div>
              <p className="text-sm font-semibold">Default for {activeChannelMeta.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                New {activeChannelMeta.label.toLowerCase()} sends use this account unless a campaign picks another.
              </p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} aria-label="Default account" />
          </div>

          <div className="space-y-2.5 rounded-2xl border border-border/70 p-4 dark:border-white/[0.07]">
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-md">
                <KeyRound className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Credentials</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {account
                    ? "Stored secrets are never returned. Add a value only when rotating a credential."
                    : "Encrypted at rest. Use the provider's API key, SMTP password or access token."}
                </p>
              </div>
            </div>
            <KeyValueEditor
              rows={credentialRows}
              onChange={setCredentialRows}
              secret
              suggestions={CREDENTIAL_PRESETS[channel]}
              addLabel="Add credential"
              emptyLabel="No credentials added. Existing secrets stay untouched when editing."
            />
          </div>

          <div className="space-y-2.5 rounded-2xl border border-border/70 p-4 dark:border-white/[0.07]">
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-md">
                <SlidersHorizontal className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Provider configuration</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Non-secret routing values such as phone number IDs, API versions or callback URLs.
                </p>
              </div>
            </div>
            <KeyValueEditor
              rows={configRows}
              onChange={setConfigRows}
              suggestions={CONFIG_PRESETS[channel]}
              addLabel="Add config"
              emptyLabel="No configuration values yet."
            />
          </div>

          {formError ? (
            <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200/70 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" loading={saveMutation.isPending}>
              {account ? "Save changes" : "Add integration"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
