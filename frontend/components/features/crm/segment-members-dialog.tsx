"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search, UserPlus } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { displayName, formatNumber } from "@/lib/format";
import type { Contact, PageResponse, Segment } from "@/lib/types";
import { crmKeys } from "@/components/features/crm/crm-keys";
import { ContactAvatar } from "@/components/features/crm/contact-visuals";
import { useDebouncedValue } from "@/components/features/crm/use-debounced-value";

const PICKER_SIZE = 8;

export function SegmentMembersDialog({
  open,
  onOpenChange,
  segment
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment: Segment;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  React.useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelected([]);
  }, [open, segment.id]);

  const contactsQuery = useQuery({
    queryKey: ["contacts", "list", { picker: segment.id, q: debouncedSearch || undefined }],
    queryFn: () =>
      apiFetch<PageResponse<Contact>>("/contacts", {
        query: {
          page: 0,
          size: PICKER_SIZE,
          q: debouncedSearch || undefined,
          status: "ACTIVE"
        }
      }),
    enabled: open
  });

  const addMutation = useMutation({
    mutationFn: (contactIds: string[]) =>
      apiFetch<{ added: number }>(`/segments/${segment.id}/members`, {
        method: "POST",
        body: { contactIds }
      }),
    onSuccess: (result) => {
      const added = result.added ?? 0;
      if (added === 0) {
        toast.info("Those contacts were already in this segment.");
      } else {
        toast.success(added === 1 ? "1 contact added to the segment" : `${formatNumber(added)} contacts added`);
      }
      void queryClient.invalidateQueries({ queryKey: crmKeys.segments.all });
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  const contacts = contactsQuery.data?.items ?? [];

  function toggle(contactId: string) {
    setSelected((current) =>
      current.includes(contactId) ? current.filter((id) => id !== contactId) : [...current, contactId]
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add members</DialogTitle>
          <DialogDescription>
            Hand-pick active contacts for <span className="font-semibold text-foreground">{segment.name}</span>.
            Contacts already in the segment are ignored.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email or phone…"
            leftIcon={<Search />}
            aria-label="Search contacts to add"
            autoFocus
          />

          <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-0.5">
            {contactsQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-2xl" />
              ))
            ) : contactsQuery.isError ? (
              <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-center">
                <p className="text-sm font-medium">Couldn&apos;t load contacts</p>
                <p className="mt-1 text-xs text-muted-foreground">Check the directory and try again.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => void contactsQuery.refetch()}
                  loading={contactsQuery.isFetching}
                >
                  Retry
                </Button>
              </div>
            ) : contacts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-center">
                <p className="text-sm font-medium">
                  {debouncedSearch ? "No contacts match that search" : "No active contacts available"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {debouncedSearch
                    ? "Try a shorter name, email or phone number."
                    : "Add or reactivate a contact in the directory first."}
                </p>
              </div>
            ) : (
              contacts.map((contact) => {
                const isSelected = selected.includes(contact.id);
                return (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => toggle(contact.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors",
                      isSelected
                        ? "border-violet-300 bg-violet-50/70 dark:border-violet-400/30 dark:bg-violet-500/10"
                        : "border-border/60 bg-card/60 hover:border-border hover:bg-secondary/40 dark:bg-white/[0.02]"
                    )}
                  >
                    <ContactAvatar contact={contact} className="size-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{displayName(contact)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {contact.email ?? contact.phone ?? "No contact details"}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                        isSelected
                          ? "border-violet-500 bg-violet-600 text-white"
                          : "border-border text-transparent"
                      )}
                    >
                      <Check className="size-3.5" />
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {selected.length > 0 ? (
            <p className="text-[11px] font-medium text-muted-foreground">
              {formatNumber(selected.length)} {selected.length === 1 ? "contact" : "contacts"} selected
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="gradient"
            disabled={selected.length === 0}
            loading={addMutation.isPending}
            onClick={() => addMutation.mutate(selected)}
          >
            <UserPlus />
            Add {selected.length > 0 ? formatNumber(selected.length) : ""} to segment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
