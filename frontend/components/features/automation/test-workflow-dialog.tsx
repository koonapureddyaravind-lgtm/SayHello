"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Mail, Phone, Play, Search, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { displayName, initials, truncate } from "@/lib/format";
import type { Contact, PageResponse, Workflow, WorkflowExecution } from "@/lib/types";
import { useDebouncedValue } from "./use-debounced-value";

function contactAddress(contact: Contact): string {
  return contact.email?.trim() || contact.phone?.trim() || "No address on file";
}

export function TestWorkflowDialog({
  workflow,
  open,
  onOpenChange,
  onTested
}: {
  workflow: Workflow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTested?: (execution: WorkflowExecution) => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [selectedContact, setSelectedContact] = React.useState<Contact | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  React.useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelectedContact(null);
  }, [open, workflow?.id]);

  const contactsQuery = useQuery({
    queryKey: ["contacts", "test-picker", debouncedSearch],
    queryFn: () =>
      apiFetch<PageResponse<Contact>>("/contacts", {
        query: { page: 0, size: 30, q: debouncedSearch || undefined }
      }),
    enabled: open,
    staleTime: 30_000
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!workflow) throw new Error("Workflow is not available");
      if (!selectedContact) throw new Error("Choose a contact to test this workflow");
      return apiFetch<WorkflowExecution>(`/workflows/${workflow.id}/test`, {
        method: "POST",
        body: { contactId: selectedContact.id }
      });
    },
    onSuccess: (execution) => {
      if (workflow) {
        void queryClient.invalidateQueries({ queryKey: ["workflows", "executions", workflow.id] });
        void queryClient.invalidateQueries({ queryKey: ["workflows", "list"] });
        void queryClient.invalidateQueries({ queryKey: ["workflows", "stats"] });
      }
      if (execution.status === "FAILED") {
        toast.error("Test run failed", {
          description: execution.errorMessage ?? "Open the executions tab to review what happened."
        });
      } else if (execution.status === "WAITING") {
        toast.success("Test run started", {
          description: "The workflow paused at a wait step and will resume automatically."
        });
      } else {
        toast.success("Test run complete", {
          description: `Executed version ${workflow?.currentVersion ?? "latest"} for ${displayName(selectedContact)}.`
        });
      }
      onOpenChange(false);
      onTested?.(execution);
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  const contacts = contactsQuery.data?.items ?? [];
  const unpublished = (workflow?.currentVersion ?? 0) === 0;
  const canSubmit = Boolean(selectedContact) && Boolean(workflow) && !unpublished && !mutation.isPending;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-[0_12px_30px_-12px_rgba(124,58,237,0.8)]">
              <Play className="size-5" />
            </div>
            <DialogTitle>Test this workflow</DialogTitle>
            <DialogDescription>
              Run the latest published version against a real contact. Messages are only sent when the contact has
              marketing consent for that channel.
            </DialogDescription>
          </DialogHeader>

          {unpublished ? (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-200/70 bg-amber-50/70 px-3.5 py-3 text-xs leading-relaxed text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>Publish this workflow before running a test. Test runs always use the latest published version.</span>
            </div>
          ) : null}

          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Choose a contact</p>
              {selectedContact ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <Check className="size-3" /> {displayName(selectedContact)}
                </span>
              ) : null}
            </div>

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email or phone…"
              leftIcon={<Search />}
              aria-label="Search contacts"
            />

            <div className="max-h-[300px] min-h-[180px] overflow-y-auto rounded-2xl border border-border/70 bg-secondary/20 p-1.5 dark:border-white/[0.08] dark:bg-white/[0.02]">
              {contactsQuery.isLoading ? (
                <div className="space-y-1.5 p-1">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 w-full rounded-xl" />
                  ))}
                </div>
              ) : contactsQuery.isError ? (
                <div className="flex h-[176px] flex-col items-center justify-center gap-2 p-4 text-center">
                  <p className="text-sm font-semibold">Couldn&apos;t load contacts</p>
                  <p className="text-xs text-muted-foreground">Check your connection and try again.</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => void contactsQuery.refetch()}>
                    Retry
                  </Button>
                </div>
              ) : contacts.length === 0 ? (
                <div className="flex h-[176px] flex-col items-center justify-center gap-1.5 p-4 text-center">
                  <Users className="size-6 text-violet-400" />
                  <p className="text-sm font-semibold">{debouncedSearch ? "No contacts match" : "No contacts yet"}</p>
                  <p className="max-w-[260px] text-xs text-muted-foreground">
                    {debouncedSearch
                      ? "Try a different name, email address or phone number."
                      : "Add a contact to your workspace to test this workflow."}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {contacts.map((contact) => {
                    const selected = selectedContact?.id === contact.id;
                    const name = displayName(contact);
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => setSelectedContact(contact)}
                        aria-pressed={selected}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                          selected
                            ? "bg-violet-50 ring-1 ring-inset ring-violet-300/70 dark:bg-violet-500/10 dark:ring-violet-400/30"
                            : "hover:bg-violet-50/60 dark:hover:bg-white/[0.05]"
                        )}
                      >
                        <Avatar className="size-8">
                          <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{name}</p>
                          <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                            {contact.email ? <Mail className="size-3 shrink-0" /> : contact.phone ? <Phone className="size-3 shrink-0" /> : null}
                            {truncate(contactAddress(contact), 42)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full border",
                            selected
                              ? "border-violet-500 bg-violet-500 text-white"
                              : "border-border/70 text-transparent dark:border-white/15"
                          )}
                        >
                          <Check className="size-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" loading={mutation.isPending} disabled={!canSubmit}>
              <Play /> Run test
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
