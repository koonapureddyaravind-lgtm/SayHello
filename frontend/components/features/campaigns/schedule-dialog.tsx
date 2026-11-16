"use client";

import * as React from "react";
import { CalendarClock } from "lucide-react";
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
import { ChannelBadge } from "@/components/common/channel-badge";
import type { Campaign } from "@/lib/types";
import { dateToLocalInput, defaultScheduleValue, localInputToIso } from "./campaign-utils";
import { useScheduleCampaign } from "./use-campaign-actions";

export function CampaignScheduleDialog({
  open,
  onOpenChange,
  campaign
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: Campaign;
}) {
  const mutation = useScheduleCampaign();
  const [value, setValue] = React.useState(defaultScheduleValue);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setValue(campaign.scheduledAt ? dateToLocalInput(campaign.scheduledAt) : defaultScheduleValue());
      setError(null);
    }
  }, [open, campaign.scheduledAt]);

  async function submit() {
    const iso = localInputToIso(value);
    if (!iso) {
      setError("Choose a valid date and time.");
      return;
    }
    setError(null);
    try {
      await mutation.mutateAsync({ campaignId: campaign.id, scheduledAt: iso });
      onOpenChange(false);
    } catch {
      // The mutation surfaces a toast with the server message.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-glow">
              <CalendarClock className="size-4" />
            </span>
            Schedule campaign
          </DialogTitle>
          <DialogDescription>Pick the moment this campaign should start sending.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-secondary/30 px-3 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{campaign.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{campaign.type === "BROADCAST" ? "Broadcast" : "Automation"}</p>
          </div>
          <ChannelBadge channel={campaign.channel} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="schedule-at">Launch date &amp; time</Label>
          <Input
            id="schedule-at"
            type="datetime-local"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground">Times use your browser&apos;s local timezone.</p>
        </div>

        {error ? (
          <p className="rounded-xl border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="gradient" onClick={() => void submit()} loading={mutation.isPending}>
            <CalendarClock /> Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
