"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api";
import type { Campaign } from "@/lib/types";

export type CampaignAction = "launch" | "pause" | "cancel" | "delete";

const SUCCESS_MESSAGES: Record<CampaignAction, string> = {
  launch: "Campaign launched",
  pause: "Campaign paused",
  cancel: "Campaign cancelled",
  delete: "Campaign deleted"
};

export function useCampaignAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ campaignId, action }: { campaignId: string; action: CampaignAction }) => {
      if (action === "delete") {
        await apiFetch<void>(`/campaigns/${campaignId}`, { method: "DELETE" });
        return null;
      }
      return apiFetch<Campaign>(`/campaigns/${campaignId}/${action}`, { method: "POST" });
    },
    onSuccess: (_data, variables) => {
      toast.success(SUCCESS_MESSAGES[variables.action]);
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (error) => toast.error(errorMessage(error))
  });
}

export function useScheduleCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, scheduledAt }: { campaignId: string; scheduledAt: string }) =>
      apiFetch<Campaign>(`/campaigns/${campaignId}/schedule`, {
        method: "POST",
        body: { scheduledAt }
      }),
    onSuccess: () => {
      toast.success("Campaign scheduled");
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (error) => toast.error(errorMessage(error))
  });
}
