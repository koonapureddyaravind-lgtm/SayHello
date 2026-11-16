"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldBan } from "lucide-react";
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
import { errorMessage } from "@/lib/api";
import type { Channel, Suppression, SuppressionReason } from "@/lib/types";
import { crmKeys } from "@/components/features/crm/crm-keys";
import { suppressionRequest } from "@/components/features/crm/suppressions-api";

const CHANNEL_OPTIONS: { value: Channel | "ALL"; label: string }[] = [
  { value: "ALL", label: "All channels" },
  { value: "EMAIL", label: "Email" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "SMS", label: "SMS" }
];

const REASON_OPTIONS: { value: SuppressionReason; label: string; hint: string }[] = [
  { value: "UNSUBSCRIBE", label: "Unsubscribe", hint: "The contact asked not to be contacted." },
  { value: "HARD_BOUNCE", label: "Hard bounce", hint: "The address rejected delivery permanently." },
  { value: "COMPLAINT", label: "Complaint", hint: "A recipient marked a message as spam." },
  { value: "MANUAL", label: "Manual", hint: "Added by an operator for policy reasons." },
  { value: "INVALID", label: "Invalid", hint: "The address is malformed or unusable." }
];

interface SuppressionPayload {
  email?: string;
  phone?: string;
  channel?: Channel;
  reason: SuppressionReason;
  note?: string;
  expiresAt?: string;
}

export function SuppressionDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [channel, setChannel] = React.useState<Channel | "ALL">("ALL");
  const [reason, setReason] = React.useState<SuppressionReason>("UNSUBSCRIBE");
  const [note, setNote] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setEmail("");
    setPhone("");
    setChannel("ALL");
    setReason("UNSUBSCRIBE");
    setNote("");
    setExpiresAt("");
    setFormError(null);
  }, [open]);

  const mutation = useMutation({
    mutationFn: (payload: SuppressionPayload) =>
      suppressionRequest<Suppression>("", { method: "POST", body: payload }),
    onSuccess: () => {
      toast.success("Suppression added");
      void queryClient.invalidateQueries({ queryKey: crmKeys.suppressions.all });
      onOpenChange(false);
    },
    onError: (error) => setFormError(errorMessage(error))
  });

  const activeReason = REASON_OPTIONS.find((option) => option.value === reason);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!email.trim() && !phone.trim()) {
      setFormError("Add an email address, a phone number, or both so the suppression can match sends.");
      return;
    }
    let expiresIso: string | undefined;
    if (expiresAt) {
      const parsed = new Date(expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        setFormError("That expiry date isn't valid.");
        return;
      }
      expiresIso = parsed.toISOString();
    }
    mutation.mutate({
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      channel: channel === "ALL" ? undefined : channel,
      reason,
      note: note.trim() || undefined,
      expiresAt: expiresIso
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a suppression</DialogTitle>
          <DialogDescription>
            Suppressed addresses are skipped across campaigns and automations. Leave the expiry blank for a permanent
            suppression.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="suppression-email">Email</Label>
              <Input
                id="suppression-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suppression-phone">Phone</Label>
              <Input
                id="suppression-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+1 555 010 2030"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="suppression-channel">Channel</Label>
              <Select value={channel} onValueChange={(value) => setChannel(value as Channel | "ALL")}>
                <SelectTrigger id="suppression-channel">
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
              <Label htmlFor="suppression-reason">Reason</Label>
              <Select value={reason} onValueChange={(value) => setReason(value as SuppressionReason)}>
                <SelectTrigger id="suppression-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeReason ? (
                <p className="text-[11px] text-muted-foreground">{activeReason.hint}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="suppression-expiry">Expires at</Label>
            <Input
              id="suppression-expiry"
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Optional. Use a date for time-boxed pauses; leave empty to suppress permanently.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="suppression-note">Note</Label>
            <Textarea
              id="suppression-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional context for the team: ticket reference, provider response, request details…"
              maxLength={500}
              className="min-h-[84px]"
            />
          </div>

          {formError ? (
            <div className="rounded-xl border border-rose-200/70 bg-rose-50/70 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200">
              {formError}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" loading={mutation.isPending}>
              <ShieldBan /> Add suppression
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
