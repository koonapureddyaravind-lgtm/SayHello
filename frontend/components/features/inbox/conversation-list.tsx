"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Inbox, MessageSquare, Search } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Pagination } from "@/components/common/pagination";
import { StatusBadge } from "@/components/common/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CardTabs } from "@/components/ui/card-tabs";
import { ChannelIcon } from "@/components/common/channel-badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { initials, truncate } from "@/lib/format";
import type { Channel, Conversation, ConversationStatus, PageResponse } from "@/lib/types";
import {
  CHANNEL_FILTERS,
  CONVERSATION_TABS,
  conversationTimestamp,
  type ConversationTab
} from "./inbox-utils";
import { useDebouncedValue } from "./use-debounced-value";

function ConversationListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 rounded-2xl px-2 py-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConversationList({
  selectedId,
  onSelect,
  className
}: {
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
  className?: string;
}) {
  const [statusTab, setStatusTab] = React.useState<ConversationTab>("ALL");
  const [channel, setChannel] = React.useState<Channel | "ALL">("ALL");
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 320);
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(20);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusTab, channel]);

  const conversationsQuery = useQuery({
    queryKey: ["conversations", "list", { page, size, statusTab, channel, q: debouncedSearch }],
    queryFn: () =>
      apiFetch<PageResponse<Conversation>>("/conversations", {
        query: {
          page,
          size,
          status: statusTab === "ALL" ? undefined : (statusTab as ConversationStatus),
          channel: channel === "ALL" ? undefined : channel,
          q: debouncedSearch || undefined
        }
      })
  });

  const conversations = conversationsQuery.data?.items ?? [];
  const totalItems = conversationsQuery.data?.totalItems ?? 0;
  const hasFilters = statusTab !== "ALL" || channel !== "ALL" || debouncedSearch.length > 0;
  const activeTabIndex = CONVERSATION_TABS.findIndex((tab) => tab.value === statusTab);

  return (
    <Card className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <div className="shrink-0 space-y-3 border-b border-border/60 p-3 dark:border-white/[0.06]">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-[0_8px_20px_-8px_rgba(124,58,237,0.8)]">
              <Inbox className="size-4" />
            </span>
            <div>
              <h2 className="font-display text-sm font-semibold leading-tight tracking-tight">Conversations</h2>
              <p className="text-[10px] text-muted-foreground">
                {conversationsQuery.isSuccess ? `${totalItems} ${totalItems === 1 ? "thread" : "threads"}` : "Loading threads"}
              </p>
            </div>
          </div>
          {conversationsQuery.isFetching && !conversationsQuery.isLoading ? (
            <span className="size-2 animate-pulse rounded-full bg-violet-500" aria-label="Refreshing" />
          ) : null}
        </div>

        <CardTabs
          tabs={CONVERSATION_TABS.map((tab) => ({ value: tab.value, label: tab.label }))}
          value={statusTab}
          onValueChange={(value) => setStatusTab(value as ConversationTab)}
          className="w-full"
        />
        <span className="sr-only" aria-live="polite">
          Showing {CONVERSATION_TABS[activeTabIndex >= 0 ? activeTabIndex : 0].label} conversations
        </span>

        <div className="space-y-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search subjects…"
            leftIcon={<Search />}
            className="h-9 text-xs"
            aria-label="Search conversations by subject"
          />
          <Select value={channel} onValueChange={(value) => setChannel(value as Channel | "ALL")}>
            <SelectTrigger className="h-9 text-xs" aria-label="Filter by channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNEL_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversationsQuery.isLoading ? (
          <ConversationListSkeleton />
        ) : conversationsQuery.isError ? (
          <div className="p-3">
            <ErrorState
              title="Inbox taking a moment"
              message="We couldn't load your conversations. Check your filters or try again."
              onRetry={() => void conversationsQuery.refetch()}
            />
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={hasFilters ? "No conversations match" : "Inbox zero"}
            description={
              hasFilters
                ? "Try another status, channel or subject search to find the thread you need."
                : "When contacts reach out on any connected channel, their conversations will land here."
            }
            className="px-5 py-12"
          />
        ) : (
          <ul className="divide-y divide-border/50 dark:divide-white/[0.04]">
            {conversations.map((conversation) => {
              const selected = conversation.id === selectedId;
              const unread = conversation.unreadCount > 0;
              const name = conversation.contactName?.trim() || conversation.contactAddress || "Unknown contact";
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(conversation)}
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "group relative flex w-full items-start gap-3 px-3 py-3 text-left transition-colors",
                      selected
                        ? "bg-violet-50/80 dark:bg-violet-500/[0.12]"
                        : "hover:bg-secondary/40 dark:hover:bg-white/[0.03]"
                    )}
                  >
                    {selected ? (
                      <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-brand-gradient" aria-hidden />
                    ) : null}

                    <div className="relative shrink-0">
                      <Avatar
                        className={cn(
                          "size-10",
                          unread && "ring-2 ring-violet-400/60 ring-offset-2 ring-offset-background"
                        )}
                      >
                        <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
                      </Avatar>
                      <ChannelIcon
                        channel={conversation.channel}
                        className="absolute -bottom-1 -right-1 size-5 rounded-md shadow-sm [&_svg]:size-3"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className={cn("min-w-0 flex-1 truncate text-sm", unread ? "font-semibold" : "font-medium")}>
                          {name}
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {conversationTimestamp(conversation.lastMessageAt) || "—"}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "mt-0.5 truncate text-xs",
                          unread ? "text-foreground/80" : "text-muted-foreground"
                        )}
                      >
                        {truncate(conversation.lastMessagePreview ?? "No messages yet", 58)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <StatusBadge status={conversation.status} dot={false} className="px-1.5 py-0 text-[9px]" />
                        {conversation.subject ? (
                          <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
                            {conversation.subject}
                          </span>
                        ) : (
                          <span className="flex-1" />
                        )}
                        {unread ? (
                          <Badge
                            variant="gradient"
                            className="size-5 shrink-0 justify-center rounded-full p-0 text-[10px]"
                            aria-label={`${conversation.unreadCount} unread messages`}
                          >
                            {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {conversationsQuery.data && conversationsQuery.data.totalItems > 0 ? (
        <Pagination
          page={conversationsQuery.data.page}
          totalPages={conversationsQuery.data.totalPages}
          totalItems={conversationsQuery.data.totalItems}
          size={conversationsQuery.data.size}
          onPageChange={setPage}
          onSizeChange={(nextSize) => {
            setSize(nextSize);
            setPage(0);
          }}
          className="shrink-0 flex-col gap-2 px-3 py-2"
        />
      ) : null}
    </Card>
  );
}
