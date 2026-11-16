"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCheck, Clock3, MessageSquare, PanelRight, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { ChannelBadge } from "@/components/common/channel-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { initials, titleCase } from "@/lib/format";
import type { Conversation, ConversationMessage, PageResponse } from "@/lib/types";
import { dayKey, dayLabel, messageTime } from "./inbox-utils";
import { MessageComposer } from "./message-composer";

function senderLabel(
  message: ConversationMessage,
  conversation: Conversation,
  memberNames: Record<string, string>
): string {
  if (message.direction === "INBOUND") {
    return (
      message.senderName?.trim() ||
      conversation.contactName?.trim() ||
      conversation.contactAddress ||
      "Contact"
    );
  }
  if (message.senderType === "BOT") return "Automation";
  if (message.senderType === "SYSTEM") return "System";
  const memberName = message.senderUserId ? memberNames[message.senderUserId] : undefined;
  return memberName || message.senderName?.trim() || "Agent";
}

function ThreadSkeleton() {
  return (
    <div className="space-y-5 p-5">
      {Array.from({ length: 5 }).map((_, index) => {
        const outbound = index % 3 === 1;
        return (
          <div key={index} className={cn("flex items-end gap-2", outbound ? "flex-row-reverse" : "flex-row")}>
            <Skeleton className="size-7 rounded-full" />
            <div className={cn("space-y-1.5", outbound ? "items-end" : "items-start")}>
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className={cn("h-14 rounded-2xl", outbound ? "w-56" : "w-64")} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ConversationThread({
  conversation,
  memberNames = {},
  onBack,
  onShowDetails,
  className
}: {
  conversation: Conversation;
  memberNames?: Record<string, string>;
  onBack?: () => void;
  onShowDetails?: () => void;
  className?: string;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const messagesQuery = useQuery({
    queryKey: ["conversations", "messages", conversation.id],
    queryFn: () =>
      apiFetch<PageResponse<ConversationMessage>>(`/conversations/${conversation.id}/messages`, {
        query: { page: 0, size: 100 }
      }),
    enabled: Boolean(conversation.id)
  });

  const messages = React.useMemo(() => {
    const items = messagesQuery.data?.items ?? [];
    return [...items].reverse();
  }, [messagesQuery.data]);

  React.useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, conversation.id]);

  const name = conversation.contactName?.trim() || conversation.contactAddress || "Unknown contact";

  return (
    <Card className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border/60 p-3 dark:border-white/[0.06] sm:p-4">
        {onBack ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onBack}
            className="lg:hidden"
            aria-label="Back to conversations"
          >
            <ArrowLeft />
          </Button>
        ) : null}

        <Avatar className="size-10 shrink-0">
          <AvatarFallback className="text-[11px]">{initials(name)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-display text-base font-semibold tracking-tight">{name}</h2>
            <StatusBadge status={conversation.status} dot={false} className="hidden sm:inline-flex" />
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <ChannelBadge channel={conversation.channel} className="hidden px-1.5 py-0 text-[9px] sm:inline-flex" />
            <span className="truncate">{conversation.contactAddress ?? "No address on file"}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void messagesQuery.refetch()}
            aria-label="Refresh messages"
          >
            <RefreshCw className={cn("size-4", messagesQuery.isFetching && "animate-spin")} />
          </Button>
          {onShowDetails ? (
            <Button
              variant="outline"
              size="icon-sm"
              onClick={onShowDetails}
              className="xl:hidden"
              aria-label="Contact and conversation details"
            >
              <PanelRight />
            </Button>
          ) : null}
        </div>
      </div>

      {conversation.subject?.trim() ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-secondary/20 px-4 py-2 text-[11px] dark:border-white/[0.06] dark:bg-white/[0.02]">
          <span className="font-bold uppercase tracking-[0.14em] text-muted-foreground">Subject</span>
          <span className="truncate text-foreground/80">{conversation.subject}</span>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-secondary/20 via-transparent to-transparent px-3 py-3 sm:px-4 sm:py-4"
      >
        <div className="mx-auto max-w-3xl">
          {messagesQuery.isLoading ? (
            <ThreadSkeleton />
          ) : messagesQuery.isError ? (
            <ErrorState
              title="Messages are taking a moment"
              message="We couldn't load this thread. The conversation may still be syncing."
              onRetry={() => void messagesQuery.refetch()}
            />
          ) : messages.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No messages yet"
              description="The first inbound message — or your reply below — will start this thread."
              className="py-12"
            />
          ) : (
            <div className="space-y-2">
              {messages.map((message, index) => {
                const previous = index > 0 ? messages[index - 1] : null;
                const currentDayKey = dayKey(message.createdAt);
                const previousDayKey = previous ? dayKey(previous.createdAt) : null;
                const showDay = currentDayKey !== previousDayKey;
                const showSender =
                  !previous ||
                  previous.direction !== message.direction ||
                  previous.senderType !== message.senderType ||
                  showDay;
                const outbound = message.direction === "OUTBOUND";
                const sender = senderLabel(message, conversation, memberNames);
                const failed = message.status === "FAILED" || message.status === "BOUNCED";
                const queued = message.status === "QUEUED" || message.status === "CREATED";

                return (
                  <React.Fragment key={message.id}>
                    {showDay ? (
                      <div className="flex items-center gap-3 py-3">
                        <span className="h-px flex-1 bg-border/60 dark:bg-white/[0.06]" />
                        <span className="rounded-full border border-border/60 bg-card/80 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground dark:border-white/[0.08]">
                          {dayLabel(message.createdAt)}
                        </span>
                        <span className="h-px flex-1 bg-border/60 dark:bg-white/[0.06]" />
                      </div>
                    ) : null}

                    <div className={cn("flex items-end gap-2", outbound ? "flex-row-reverse" : "flex-row")}>
                      <Avatar className="size-7 shrink-0">
                        <AvatarFallback className="text-[9px]">{initials(sender)}</AvatarFallback>
                      </Avatar>

                      <div
                        className={cn(
                          "flex min-w-0 max-w-[85%] flex-col sm:max-w-[72%]",
                          outbound ? "items-end" : "items-start"
                        )}
                      >
                        {showSender ? (
                          <p className="mb-1 px-1 text-[10px] font-semibold text-muted-foreground">{sender}</p>
                        ) : null}

                        <div
                          className={cn(
                            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                            outbound
                              ? "rounded-br-md bg-brand-gradient text-white"
                              : "rounded-bl-md border border-border/70 bg-card/90 text-foreground dark:border-white/[0.08]"
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        </div>

                        <div
                          className={cn(
                            "mt-1 flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground",
                            outbound && "justify-end"
                          )}
                        >
                          <span>{messageTime(message.createdAt)}</span>
                          {outbound ? (
                            <>
                              <span aria-hidden>·</span>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1",
                                  failed && "text-rose-500"
                                )}
                                title={`Delivery status: ${titleCase(message.status)}`}
                              >
                                {queued ? <Clock3 className="size-3" /> : <CheckCheck className="size-3" />}
                                {titleCase(message.status)}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <MessageComposer
        conversationId={conversation.id}
        className="shrink-0 border-t border-border/60 p-3 dark:border-white/[0.06]"
      />
    </Card>
  );
}
