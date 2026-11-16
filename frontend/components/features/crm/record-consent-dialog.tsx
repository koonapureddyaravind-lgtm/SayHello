"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Search, ShieldCheck, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, errorMessage } from "@/lib/api";
import { displayName } from "@/lib/format";
import type { Channel, ConsentPurpose, ConsentRecord, ConsentStatus, Contact, PageResponse } from "@/lib/types";
import { crmKeys } from "@/components/features/crm/crm-keys";
import { ContactAvatar } from "@/components/features/crm/contact-visuals";
import { useDebouncedValue } from "@/components/features/crm/use-debounced-value";

type ContactIdentity = Pick<Contact, "id"> & Partial<Pick<Contact, "firstName" | "lastName" | "email">>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CHANNEL_OPTIONS: { value: Channel; label: string }[] = [
  { value: "EMAIL", label: "Email" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "SMS", label: "SMS" }
];

const PURPOSE_OPTIONS: { value: ConsentPurpose; label: string }[] = [
  { value: "MARKETING", label: "Marketing" },
  { value: "TRANSACTIONAL", label: "Transactional" }
];

const STATUS_OPTIONS: { value: ConsentStatus; label: string }[] = [
  { value: "GRANTED", label: "Granted" },
  { value: "DENIED", label: "Denied" },
  { value: "WITHDRAWN", label: "Withdrawn" }
];

interface ConsentPayload {
  contactId: string;
  channel: Channel;
  purpose: ConsentPurpose;
  status: ConsentStatus;
  source: string;
  evidence?: Record<string, unknown>;
}

export function RecordConsentDialog({
  open,
  onOpenChange,
  contact
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: ContactIdentity | null;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = React.useState<ContactIdentity | null>(null);
  const [search, setSearch] = React.useState("");
  const [channel, setChannel] = React.useState<Channel>("EMAIL");
  const [purpose, setPurpose] = React.useState<ConsentPurpose>("MARKETING");
  const [status, setStatus] = React.useState<ConsentStatus>("GRANTED");
  const [source, setSource] = React.useState("ADMIN_UI");
  const [note, setNote] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const contactsQuery = useQuery({
    queryKey: crmKeys.contacts.list({ q: debouncedSearch, size: 8, page: 0 }),
    queryFn: () => apiFetch<PageResponse<Contact>>("/contacts", { query: { q: debouncedSearch, page: 0, size: 8 } }),
    enabled: open && debouncedSearch.length >= 2
  });

  React.useEffect(() => {
    if (!open) return;
    setSelected(contact ?? null);
    setSearch("");
    setChannel("EMAIL");
    setPurpose("MARKETING");
    setStatus("GRANTED");
    setSource("ADMIN_UI");
    setNote("");
    setFormError(null);
  }, [open, contact]);

  const mutation = useMutation({
    mutationFn: (payload: ConsentPayload) =>
      apiFetch<ConsentRecord>("/consent", { method: "POST", body: payload }),
    onSuccess: () => {
      toast.success("Consent recorded");
      void queryClient.invalidateQueries({ queryKey: crmKeys.consent.all });
      void queryClient.invalidateQueries({ queryKey: crmKeys.suppressions.all });
      onOpenChange(false);
    },
    onError: (error) => setFormError(errorMessage(error))
  });

  const trimmedSearch = search.trim();
  const manualId = UUID_PATTERN.test(trimmedSearch) ? trimmedSearch : null;
  const results = contactsQuery.data?.items ?? [];
  const suppressesContact = purpose === "MARKETING" && (status === "DENIED" || status === "WITHDRAWN");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!selected) {
      setFormError("Choose the contact this consent record belongs to.");
      return;
    }
    if (!source.trim()) {
      setFormError("Add a source so the record shows where consent came from.");
      return;
    }
    mutation.mutate({
      contactId: selected.id,
      channel,
      purpose,
      status,
      source: source.trim(),
      evidence: note.trim() ? { note: note.trim() } : undefined
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record consent</DialogTitle>
          <DialogDescription>
            Log an immutable consent event with its channel, purpose, status and supporting evidence.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="consent-contact-search">Contact</Label>
            {selected ? (
              <div className="flex items-center gap-3 rounded-2xl border border-violet-200/70 bg-violet-50/50 p-3 dark:border-violet-400/20 dark:bg-violet-500/10">
                <ContactAvatar contact={selected} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{displayName(selected)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selected.email ?? selected.id}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSelected(null)}
                  aria-label="Change contact"
                >
                  <X />
                </Button>
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-border/70 px-3.5 py-3 text-xs text-muted-foreground">
                Search for a contact by name, email or phone below.
              </p>
            )}

            <Input
              id="consent-contact-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search contacts…"
              leftIcon={<Search />}
              autoComplete="off"
            />

            {trimmedSearch.length >= 2 ? (
              <div className="max-h-56 overflow-y-auto rounded-2xl border border-border/60 bg-card/60 p-1.5 dark:bg-white/[0.02]">
                {contactsQuery.isLoading ? (
                  <div className="space-y-1.5 p-1">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="h-12 animate-pulse rounded-xl bg-secondary" />
                    ))}
                  </div>
                ) : contactsQuery.isError ? (
                  <div className="p-3 text-xs text-rose-600 dark:text-rose-300">
                    Couldn&apos;t search contacts.{" "}
                    <button
                      type="button"
                      className="font-semibold underline"
                      onClick={() => void contactsQuery.refetch()}
                    >
                      Retry
                    </button>
                  </div>
                ) : results.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground">
                    No contacts match “{trimmedSearch}”.
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {results.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => {
                          setSelected(result);
                          setSearch("");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-violet-50/70 dark:hover:bg-white/[0.05]"
                      >
                        <ContactAvatar contact={result} className="size-8" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{displayName(result)}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {result.email ?? result.phone ?? result.id}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {!selected && manualId ? (
              <button
                type="button"
                className="text-xs font-semibold text-violet-600 underline dark:text-violet-300"
                onClick={() => setSelected({ id: manualId })}
              >
                Use contact ID “{manualId}”
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="consent-channel">Channel</Label>
              <Select value={channel} onValueChange={(value) => setChannel(value as Channel)}>
                <SelectTrigger id="consent-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="consent-purpose">Purpose</Label>
              <Select value={purpose} onValueChange={(value) => setPurpose(value as ConsentPurpose)}>
                <SelectTrigger id="consent-purpose">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PURPOSE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="consent-status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as ConsentStatus)}>
                <SelectTrigger id="consent-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="consent-source">Source</Label>
            <Input
              id="consent-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="ADMIN_UI, SIGNUP_FORM, IMPORT…"
              maxLength={64}
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Where the consent was captured. Keep it short and consistent for audits.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="consent-note">Evidence note</Label>
            <Textarea
              id="consent-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional context: form URL, double opt-in message ID, support ticket…"
              className="min-h-[84px]"
            />
          </div>

          {suppressesContact ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/60 px-3.5 py-2.5 text-xs text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <span>
                A marketing {status.toLowerCase()} also adds this contact to the channel suppression list.
              </span>
            </div>
          ) : null}

          {formError ? (
            <div className="rounded-xl border border-rose-200/70 bg-rose-50/70 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200">
              {formError}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" loading={mutation.isPending} disabled={!selected}>
              <BadgeCheck /> Record consent
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
