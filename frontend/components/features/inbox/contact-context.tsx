"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, ExternalLink, Mail, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";
import { ChannelBadge } from "@/components/common/channel-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { displayName, formatDateTime, formatRelative, initials, titleCase } from "@/lib/format";
import type { Contact, Conversation, ConversationStatus, Membership } from "@/lib/types";

const CONVERSATION_STATUSES: ConversationStatus[] = ["OPEN", "PENDING", "RESOLVED", "SNOOZED"];

function memberLabel(member: Membership): string {
  return member.fullName?.trim() || member.email;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium text-foreground/90">{children}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{children}</p>
  );
}

export function ContactContext({
  conversation,
  members = [],
  showHeader = true,
  className
}: {
  conversation: Conversation;
  members?: Membership[];
  showHeader?: boolean;
  className?: string;
}) {
  const queryClient = useQueryClient();

  const contactQuery = useQuery({
    queryKey: ["contacts", "detail", conversation.contactId],
    queryFn: () => apiFetch<Contact>(`/contacts/${conversation.contactId}`),
    staleTime: 60_000
  });

  const statusMutation = useMutation({
    mutationFn: (status: ConversationStatus) =>
      apiFetch<Conversation>(`/conversations/${conversation.id}/status`, {
        method: "POST",
        body: { status }
      }),
    onSuccess: (updated) => {
      toast.success(`Marked ${titleCase(updated.status)}`, {
        description: "The conversation status is shared across your team's inbox."
      });
      queryClient.setQueryData<Conversation>(
        ["conversations", "detail", conversation.id],
        (previous) =>
          previous
            ? { ...previous, status: updated.status, unreadCount: updated.unreadCount }
            : updated
      );
      void queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  const assignMutation = useMutation({
    mutationFn: (userId: string) =>
      apiFetch<Conversation>(`/conversations/${conversation.id}/assign`, {
        method: "POST",
        body: { userId }
      }),
    onSuccess: (updated) => {
      const assignee = members.find((member) => member.userId === updated.assigneeUserId);
      toast.success("Conversation assigned", {
        description: assignee ? `Now owned by ${memberLabel(assignee)}.` : "The assignee was updated."
      });
      queryClient.setQueryData<Conversation>(
        ["conversations", "detail", conversation.id],
        (previous) =>
          previous ? { ...previous, assigneeUserId: updated.assigneeUserId } : updated
      );
      void queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  const contact = contactQuery.data;
  const fallbackName = conversation.contactName?.trim() || conversation.contactAddress || "Unknown contact";
  const profileName = contact ? displayName(contact) : "";
  const name = profileName && profileName !== "Unknown" ? profileName : fallbackName;
  const assigneeValue = conversation.assigneeUserId ?? "unassigned";
  const unresolvedAssigneeId =
    conversation.assigneeUserId &&
    !members.some((member) => member.userId === conversation.assigneeUserId)
      ? conversation.assigneeUserId
      : null;

  const attributeEntries = React.useMemo(() => {
    return Object.entries(contact?.attributes ?? {})
      .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
      .slice(0, 6);
  }, [contact]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {showHeader ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 py-3 dark:border-white/[0.06]">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-gradient-soft text-violet-600 dark:text-violet-300">
              <UserRound className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">Contact context</p>
              <p className="truncate text-[10px] text-muted-foreground">Profile, ownership and status</p>
            </div>
          </div>
          {contact ? (
            <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${name} in contacts`}>
              <Link href={`/contacts/${contact.id}`}>
                <ExternalLink />
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <div>
          <div className="flex items-start gap-3">
            <Avatar className="size-12 shrink-0">
              <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base font-semibold tracking-tight">{name}</p>
              {contactQuery.isLoading ? (
                <div className="mt-2 space-y-1.5">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              ) : (
                <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                  {contact?.email ? (
                    <p className="flex items-center gap-1.5 truncate">
                      <Mail className="size-3 shrink-0" />
                      <span className="truncate">{contact.email}</span>
                    </p>
                  ) : null}
                  {contact?.phone ? (
                    <p className="flex items-center gap-1.5 truncate">
                      <Phone className="size-3 shrink-0" />
                      <span className="truncate">{contact.phone}</span>
                    </p>
                  ) : null}
                  {!contact?.email && !contact?.phone ? (
                    <p className="truncate">{conversation.contactAddress ?? "No contact details on file"}</p>
                  ) : null}
                </div>
              )}
              {contact ? (
                <div className="mt-2">
                  <StatusBadge status={contact.status} className="px-2 py-0 text-[10px]" />
                </div>
              ) : null}
            </div>
          </div>

          {contactQuery.isError ? (
            <div className="mt-3 rounded-xl border border-amber-200/60 bg-amber-50/60 p-2.5 text-[11px] text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
              We couldn&apos;t load the full contact profile.{" "}
              <button
                type="button"
                onClick={() => void contactQuery.refetch()}
                className="font-semibold underline underline-offset-2"
              >
                Retry
              </button>
            </div>
          ) : null}

          {contact?.tags && contact.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {contact.tags.slice(0, 8).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-secondary/30 px-2 py-0.5 text-[10px] font-medium dark:border-white/[0.06] dark:bg-white/[0.03]"
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                    aria-hidden
                  />
                  {tag.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-3 rounded-2xl border border-border/60 bg-secondary/20 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
          <SectionLabel>Conversation controls</SectionLabel>

          <div className="space-y-1.5">
            <Label htmlFor="conversation-status" className="text-[11px] text-muted-foreground">
              Status
            </Label>
            <Select
              value={conversation.status}
              onValueChange={(value) => statusMutation.mutate(value as ConversationStatus)}
              disabled={statusMutation.isPending}
            >
              <SelectTrigger id="conversation-status" className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONVERSATION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {titleCase(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="conversation-assignee" className="text-[11px] text-muted-foreground">
              Assignee
            </Label>
            <Select
              value={assigneeValue}
              onValueChange={(value) => {
                if (value === "unassigned" || value === conversation.assigneeUserId) return;
                assignMutation.mutate(value);
              }}
              disabled={assignMutation.isPending || members.length === 0}
            >
              <SelectTrigger id="conversation-assignee" className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned" disabled>
                  Unassigned
                </SelectItem>
                {unresolvedAssigneeId ? (
                  <SelectItem value={unresolvedAssigneeId}>
                    {`User ${unresolvedAssigneeId.slice(0, 8)}`}
                  </SelectItem>
                ) : null}
                {members.map((member) => (
                  <SelectItem key={member.membershipId} value={member.userId}>
                    {memberLabel(member)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {members.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">No team members available to assign.</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <SectionLabel>Thread details</SectionLabel>
          <div className="mt-1 divide-y divide-border/50 dark:divide-white/[0.04]">
            <DetailRow label="Channel">
              <ChannelBadge channel={conversation.channel} className="px-2 py-0 text-[10px]" />
            </DetailRow>
            <DetailRow label="Address">
              <span className="block max-w-[170px] truncate" title={conversation.contactAddress ?? undefined}>
                {conversation.contactAddress ?? "—"}
              </span>
            </DetailRow>
            <DetailRow label="Subject">
              <span className="block max-w-[170px] truncate" title={conversation.subject ?? undefined}>
                {conversation.subject?.trim() || "—"}
              </span>
            </DetailRow>
            <DetailRow label="Unread">
              {conversation.unreadCount > 0 ? `${conversation.unreadCount} message${conversation.unreadCount === 1 ? "" : "s"}` : "All caught up"}
            </DetailRow>
            <DetailRow label="Last activity">
              <span className="inline-flex items-center gap-1" title={formatDateTime(conversation.lastMessageAt)}>
                <Clock3 className="size-3 text-muted-foreground" />
                {formatRelative(conversation.lastMessageAt)}
              </span>
            </DetailRow>
            <DetailRow label="Started">
              <span title={formatDateTime(conversation.createdAt)}>
                {formatDateTime(conversation.createdAt)}
              </span>
            </DetailRow>
          </div>
        </div>

        {attributeEntries.length > 0 ? (
          <div className="space-y-1">
            <SectionLabel>Contact attributes</SectionLabel>
            <div className="mt-1 divide-y divide-border/50 dark:divide-white/[0.04]">
              {attributeEntries.map(([key, value]) => (
                <DetailRow key={key} label={titleCase(key)}>
                  <span className="block max-w-[170px] truncate" title={String(value)}>
                    {String(value)}
                  </span>
                </DetailRow>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
