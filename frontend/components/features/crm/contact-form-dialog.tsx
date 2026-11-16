"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Trash2 } from "lucide-react";
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
import { apiFetch, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { Contact, ContactStatus, Tag } from "@/lib/types";
import { crmKeys } from "@/components/features/crm/crm-keys";
import { tagVisual } from "@/components/features/crm/contact-visuals";

interface AttributeRow {
  id: string;
  key: string;
  value: string;
}

interface ContactPayload {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  status: ContactStatus;
  source?: string;
  attributes: Record<string, string>;
  tags: string[];
}

const STATUS_OPTIONS: { value: ContactStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "UNSUBSCRIBED", label: "Unsubscribed" },
  { value: "BOUNCED", label: "Bounced" }
];

let attributeRowSequence = 0;

function newAttributeRow(key = "", value = ""): AttributeRow {
  attributeRowSequence += 1;
  return { id: `attr-${Date.now()}-${attributeRowSequence}`, key, value };
}

function attributeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  onSaved
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  onSaved?: (contact: Contact) => void;
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [status, setStatus] = React.useState<ContactStatus>("ACTIVE");
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [attributes, setAttributes] = React.useState<AttributeRow[]>([]);
  const [formError, setFormError] = React.useState<string | null>(null);

  const tagsQuery = useQuery({
    queryKey: crmKeys.tags,
    queryFn: () => apiFetch<Tag[]>("/tags"),
    enabled: open
  });

  React.useEffect(() => {
    if (!open) return;
    setEmail(contact?.email ?? "");
    setPhone(contact?.phone ?? "");
    setFirstName(contact?.firstName ?? "");
    setLastName(contact?.lastName ?? "");
    setStatus(contact?.status ?? "ACTIVE");
    setSelectedTags(contact?.tags?.map((tag) => tag.name) ?? []);
    setAttributes(
      Object.entries(contact?.attributes ?? {}).map(([key, value]) => newAttributeRow(key, attributeValue(value)))
    );
    setFormError(null);
  }, [open, contact]);

  const tags = tagsQuery.data ?? [];

  const mutation = useMutation({
    mutationFn: (payload: ContactPayload) =>
      contact
        ? apiFetch<Contact>(`/contacts/${contact.id}`, { method: "PATCH", body: payload })
        : apiFetch<Contact>("/contacts", { method: "POST", body: payload }),
    onSuccess: (saved) => {
      toast.success(contact ? "Contact updated" : "Contact added");
      void queryClient.invalidateQueries({ queryKey: crmKeys.contacts.all });
      void queryClient.invalidateQueries({ queryKey: crmKeys.tags });
      void queryClient.invalidateQueries({ queryKey: crmKeys.contacts.detail(saved.id) });
      onSaved?.(saved);
      onOpenChange(false);
    },
    onError: (error) => setFormError(errorMessage(error))
  });

  function toggleTag(name: string) {
    setSelectedTags((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    );
  }

  function updateAttribute(id: string, patch: Partial<AttributeRow>) {
    setAttributes((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!email.trim() && !phone.trim()) {
      setFormError("Add at least one of email or phone so the contact can be reached.");
      return;
    }
    const cleanedAttributes: Record<string, string> = {};
    for (const row of attributes) {
      const key = row.key.trim();
      if (key) cleanedAttributes[key] = row.value;
    }

    mutation.mutate({
      email: email.trim(),
      phone: phone.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      status,
      source: contact ? undefined : "MANUAL",
      attributes: cleanedAttributes,
      tags: selectedTags
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "Add a contact"}</DialogTitle>
          <DialogDescription>
            {contact
              ? "Update identity, status and attributes. Tag changes sync by name."
              : "Create a complete profile so every channel and segment has the context it needs."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ada@example.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input
                id="contact-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+1 555 010 2030"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-first-name">First name</Label>
              <Input
                id="contact-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="Ada"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-last-name">Last name</Label>
              <Input
                id="contact-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Lovelace"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as ContactStatus)}>
                <SelectTrigger id="contact-status">
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
            <div className="space-y-1.5">
              <Label>Source</Label>
              <div className="flex h-11 items-center rounded-xl border border-input bg-secondary/40 px-3.5 text-sm text-muted-foreground dark:bg-white/[0.03]">
                {contact?.source ? contact.source : "MANUAL"}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tags</Label>
              <span className="text-[11px] text-muted-foreground">
                {selectedTags.length > 0 ? `${selectedTags.length} selected` : "Optional"}
              </span>
            </div>
            {tagsQuery.isLoading ? (
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-7 w-20 animate-pulse rounded-full bg-secondary" />
                ))}
              </div>
            ) : tags.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 px-3 py-2.5 text-xs text-muted-foreground">
                No tags yet. Create them from “Manage tags” on the contacts directory.
              </p>
            ) : (
              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-border/60 bg-secondary/20 p-2.5 dark:bg-white/[0.02]">
                {tags.map((tag) => {
                  const selected = selectedTags.includes(tag.name);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.name)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all",
                        selected ? "ring-2 ring-violet-500/30" : "opacity-70 hover:opacity-100"
                      )}
                      style={tagVisual(tag.color)}
                      aria-pressed={selected}
                    >
                      {selected ? <Check className="size-3" /> : <span className="size-1.5 rounded-full bg-current" />}
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label>Custom attributes</Label>
                <p className="mt-1 text-[11px] text-muted-foreground">Free-form key/value pairs stored on this contact.</p>
              </div>
              <Button
                type="button"
                variant="soft"
                size="sm"
                onClick={() => setAttributes((current) => [...current, newAttributeRow()])}
              >
                <Plus /> Add field
              </Button>
            </div>
            {attributes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 px-3 py-2.5 text-xs text-muted-foreground">
                No custom attributes yet. Add company, lifecycle stage, plan or any other context.
              </p>
            ) : (
              <div className="space-y-2">
                {attributes.map((row) => (
                  <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Input
                      value={row.key}
                      onChange={(event) => updateAttribute(row.id, { key: event.target.value })}
                      placeholder="key"
                      aria-label="Attribute key"
                    />
                    <Input
                      value={row.value}
                      onChange={(event) => updateAttribute(row.id, { value: event.target.value })}
                      placeholder="value"
                      aria-label="Attribute value"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-rose-600"
                      onClick={() => setAttributes((current) => current.filter((item) => item.id !== row.id))}
                      aria-label="Remove attribute"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            )}
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
              {contact ? "Save changes" : "Add contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
