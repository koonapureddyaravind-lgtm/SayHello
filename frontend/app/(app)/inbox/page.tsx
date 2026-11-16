"use client";

import * as React from "react";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox as InboxIcon, RefreshCw, UserRound } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactContext } from "@/components/features/inbox/contact-context";
import { ConversationList } from "@/components/features/inbox/conversation-list";
import { ConversationThread } from "@/components/features/inbox/conversation-thread";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { Conversation, Membership, PageResponse } from "@/lib/types";

type MobilePane = "list" | "thread";

function ThreadPlaceholder() {
  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/60 p-4 dark:border-white/[0.06]">
        <Skeleton className="size-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <div className="flex-1 space-y-4 p-5">
        <Skeleton className="h-16 w-3/4 rounded-2xl" />
        <Skeleton className="ml-auto h-16 w-1/2 rounded-2xl" />
        <Skeleton className="h-20 w-2/3 rounded-2xl" />
      </div>
      <div className="border-t border-border/60 p-3 dark:border-white/[0.06]">
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    </Card>
  );
}

export default function InboxPage() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useWorkspace();
  const organizationId = currentOrganization?.id;

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = React.useState<Conversation | null>(null);
  const [mobilePane, setMobilePane] = React.useState<MobilePane>("list");
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const conversationId = params.get("conversation");
    if (conversationId) {
      setSelectedId(conversationId);
      setMobilePane("thread");
    }
  }, []);

  const detailQuery = useQuery({
    queryKey: ["conversations", "detail", selectedId],
    queryFn: () => {
      if (!selectedId) throw new Error("No conversation selected");
      return apiFetch<Conversation>(`/conversations/${selectedId}`);
    },
    enabled: Boolean(selectedId)
  });

  const membersQuery = useQuery({
    queryKey: ["members", organizationId, "inbox-assignees"],
    queryFn: () => {
      if (!organizationId) throw new Error("No workspace selected");
      return apiFetch<PageResponse<Membership>>(`/organizations/${organizationId}/members`, {
        query: { page: 0, size: 100 }
      });
    },
    enabled: Boolean(organizationId),
    staleTime: 60_000
  });

  const members = React.useMemo(() => membersQuery.data?.items ?? [], [membersQuery.data]);

  const memberNames = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const member of members) {
      map[member.userId] = member.fullName?.trim() || member.email;
    }
    return map;
  }, [members]);

  const conversation = detailQuery.data ?? selectedPreview;
  const conversationsFetching = useIsFetching({ queryKey: ["conversations"] }) > 0;

  const selectConversation = React.useCallback((next: Conversation) => {
    setSelectedId(next.id);
    setSelectedPreview(next);
    setMobilePane("thread");
    const url = new URL(window.location.href);
    url.searchParams.set("conversation", next.id);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const refreshAll = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }, [queryClient]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Engage"
        title="Shared inbox"
        description="Triage every email, WhatsApp and SMS conversation in one calm workspace — read the full thread, assign an owner and reply without losing context."
        actions={
          <>
            <span className="hidden items-center gap-1.5 rounded-xl border border-border/70 bg-card/60 px-3 py-2 text-xs text-muted-foreground sm:inline-flex dark:border-white/[0.08] dark:bg-white/[0.03]">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live queue
            </span>
            <Button variant="outline" onClick={refreshAll}>
              <RefreshCw className={cn("size-4", conversationsFetching && "animate-spin")} />
              Refresh
            </Button>
          </>
        }
      />

      <div className="grid h-[calc(100dvh-13rem)] min-h-[560px] gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_300px]">
        <div className={cn("min-h-0", mobilePane === "thread" ? "hidden lg:block" : "block")}>
          <ConversationList selectedId={selectedId} onSelect={selectConversation} />
        </div>

        <div className={cn("min-h-0", mobilePane === "list" ? "hidden lg:block" : "block")}>
          {conversation ? (
            <ConversationThread
              conversation={conversation}
              memberNames={memberNames}
              onBack={() => setMobilePane("list")}
              onShowDetails={() => setDetailsOpen(true)}
            />
          ) : selectedId && detailQuery.isError ? (
            <Card className="flex h-full min-h-0 items-center justify-center overflow-hidden p-4">
              <ErrorState
                title="We couldn't open this conversation"
                message="It may have been removed, or you may not have access to it anymore."
                onRetry={() => void detailQuery.refetch()}
              />
            </Card>
          ) : selectedId ? (
            <ThreadPlaceholder />
          ) : (
            <Card className="flex h-full min-h-0 items-center justify-center overflow-hidden">
              <EmptyState
                icon={InboxIcon}
                title="Choose a conversation"
                description="Pick a thread from the list to read every message, reply and keep the full context in one place."
              />
            </Card>
          )}
        </div>

        <div className="hidden min-h-0 xl:block">
          {conversation ? (
            <Card className="flex h-full min-h-0 flex-col overflow-hidden">
              <ContactContext conversation={conversation} members={members} />
            </Card>
          ) : (
            <Card className="flex h-full items-center justify-center overflow-hidden">
              <EmptyState
                icon={UserRound}
                title="Contact context"
                description="Select a conversation to see the contact profile, ownership and thread metadata."
                className="px-5 py-12"
              />
            </Card>
          )}
        </div>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[85dvh] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border/60 px-5 py-4 pr-12 dark:border-white/[0.06]">
            <DialogTitle>Contact &amp; conversation</DialogTitle>
            <DialogDescription>Profile, ownership and thread controls for this conversation.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-hidden">
            {conversation ? (
              <ContactContext conversation={conversation} members={members} showHeader={false} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
