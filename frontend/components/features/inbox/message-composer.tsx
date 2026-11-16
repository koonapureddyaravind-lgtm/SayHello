"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CornerDownLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, errorMessage } from "@/lib/api";
import type { ConversationMessage } from "@/lib/types";

export function MessageComposer({
  conversationId,
  disabled = false,
  className
}: {
  conversationId: string;
  disabled?: boolean;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const replyMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiFetch<ConversationMessage>(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: { body: message }
      });
    },
    onSuccess: () => {
      setBody("");
      toast.success("Reply queued", {
        description: "Your message was handed to the delivery pipeline for this channel."
      });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      textareaRef.current?.focus();
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  const trimmed = body.trim();
  const canSend = trimmed.length > 0 && !replyMutation.isPending && !disabled;

  function submit() {
    if (!canSend) return;
    replyMutation.mutate(trimmed);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className={className}>
      <div className="rounded-2xl bg-gradient-to-r from-violet-500/40 via-fuchsia-500/30 to-sky-500/30 p-px shadow-[0_16px_40px_-30px_rgba(124,58,237,0.9)]">
        <div className="rounded-[15px] bg-card/95 p-2 backdrop-blur">
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a reply…"
            className="min-h-[64px] resize-none border-0 bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:!border-transparent focus-visible:!ring-0"
            maxLength={20000}
            disabled={disabled || replyMutation.isPending}
            aria-label="Reply to conversation"
          />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <CornerDownLeft className="size-3" />
              Enter to send · Shift + Enter for a new line
              {body.length > 0 ? <span className="ml-1 tabular-nums">{body.length}/20000</span> : null}
            </p>
            <Button
              type="button"
              variant="gradient"
              size="sm"
              onClick={submit}
              loading={replyMutation.isPending}
              disabled={!canSend}
            >
              <Send /> Send reply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
