"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Filter, Megaphone, Radio, Rocket, Sparkles, Workflow } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { channelMeta } from "@/components/common/channel-badge";
import { apiFetch, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatNumber, titleCase } from "@/lib/format";
import type {
  Campaign,
  CampaignType,
  Channel,
  PageResponse,
  Segment,
  Template
} from "@/lib/types";
import { CHANNEL_OPTIONS, defaultScheduleValue, localInputToIso } from "./campaign-utils";

interface CampaignFormState {
  name: string;
  description: string;
  channel: Channel;
  type: CampaignType;
  templateId: string;
  segmentId: string;
  subject: string;
  senderName: string;
  senderAddress: string;
}

type SubmitMode = "draft" | "launch" | "schedule";

function emptyForm(): CampaignFormState {
  return {
    name: "",
    description: "",
    channel: "EMAIL",
    type: "BROADCAST",
    templateId: "none",
    segmentId: "none",
    subject: "",
    senderName: "",
    senderAddress: ""
  };
}

function buildCampaignPayload(form: CampaignFormState) {
  const payload: {
    name: string;
    description?: string;
    channel: Channel;
    type: CampaignType;
    templateId?: string;
    segmentId?: string;
    subject?: string;
    senderName?: string;
    senderAddress?: string;
  } = {
    name: form.name.trim(),
    channel: form.channel,
    type: form.type
  };

  if (form.description.trim()) payload.description = form.description.trim();
  if (form.templateId !== "none") payload.templateId = form.templateId;
  if (form.segmentId !== "none") payload.segmentId = form.segmentId;
  if (form.channel === "EMAIL" && form.subject.trim()) payload.subject = form.subject.trim();
  if (form.senderName.trim()) payload.senderName = form.senderName.trim();
  if (form.senderAddress.trim()) payload.senderAddress = form.senderAddress.trim();

  return payload;
}

export function CampaignFormDialog({
  open,
  onOpenChange,
  onCreated
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (campaign: Campaign) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<CampaignFormState>(emptyForm);
  const [scheduleEnabled, setScheduleEnabled] = React.useState(false);
  const [scheduledAt, setScheduledAt] = React.useState(defaultScheduleValue);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setScheduleEnabled(false);
      setScheduledAt(defaultScheduleValue());
      setError(null);
    }
  }, [open]);

  const segmentsQuery = useQuery({
    queryKey: ["segments", "options"],
    queryFn: () => apiFetch<PageResponse<Segment>>("/segments", { query: { page: 0, size: 100 } }),
    enabled: open,
    staleTime: 60_000
  });

  const templatesQuery = useQuery({
    queryKey: ["templates", "options", form.channel],
    queryFn: () =>
      apiFetch<PageResponse<Template>>("/templates", {
        query: { page: 0, size: 100, channel: form.channel }
      }),
    enabled: open,
    staleTime: 30_000
  });

  const segments = segmentsQuery.data?.items ?? [];
  const templates = templatesQuery.data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: async (variables: {
      mode: SubmitMode;
      payload: ReturnType<typeof buildCampaignPayload>;
      scheduledAtIso?: string;
    }) => {
      const campaign = await apiFetch<Campaign>("/campaigns", { method: "POST", body: variables.payload });
      if (variables.mode === "launch") {
        await apiFetch<Campaign>(`/campaigns/${campaign.id}/launch`, { method: "POST" });
      }
      if (variables.mode === "schedule") {
        if (!variables.scheduledAtIso) throw new Error("Choose a valid schedule date and time.");
        await apiFetch<Campaign>(`/campaigns/${campaign.id}/schedule`, {
          method: "POST",
          body: { scheduledAt: variables.scheduledAtIso }
        });
      }
      return { campaign, mode: variables.mode };
    },
    onSuccess: ({ campaign, mode }) => {
      toast.success(
        mode === "launch" ? "Campaign launched" : mode === "schedule" ? "Campaign scheduled" : "Draft saved"
      );
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      onOpenChange(false);
      onCreated?.(campaign);
    },
    onError: (mutationError) => toast.error(errorMessage(mutationError))
  });

  const pending = createMutation.isPending;
  const pendingMode = createMutation.variables?.mode;

  function update(patch: Partial<CampaignFormState>) {
    setForm((previous) => ({ ...previous, ...patch }));
  }

  function selectChannel(channel: Channel) {
    update({ channel, templateId: "none" });
  }

  function submit(mode: SubmitMode) {
    if (!form.name.trim()) {
      setError("Give your campaign a name before continuing.");
      return;
    }
    if (mode !== "draft" && form.segmentId === "none") {
      setError("Choose an audience segment before launching or scheduling this campaign.");
      return;
    }
    const scheduledAtIso = mode === "schedule" ? localInputToIso(scheduledAt) : undefined;
    if (mode === "schedule" && !scheduledAtIso) {
      setError("Choose a valid schedule date and time.");
      return;
    }
    setError(null);
    createMutation.mutate({ mode, payload: buildCampaignPayload(form), scheduledAtIso });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
              <Megaphone className="size-4" />
            </span>
            New campaign
          </DialogTitle>
          <DialogDescription>
            Set the audience and message source, then save a draft or start sending right away.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">Campaign name</Label>
            <Input
              id="campaign-name"
              value={form.name}
              onChange={(event) => update({ name: event.target.value })}
              placeholder="Spring product launch"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campaign-description">Description</Label>
            <Textarea
              id="campaign-description"
              value={form.description}
              onChange={(event) => update({ description: event.target.value })}
              placeholder="What is this campaign about? Visible to your team."
              className="min-h-[74px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Channel</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {CHANNEL_OPTIONS.map((option) => {
                const meta = channelMeta(option.value);
                const Icon = meta.icon;
                const active = form.channel === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => selectChannel(option.value)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-2xl border p-3 text-left transition-all",
                      active
                        ? "border-violet-400/70 bg-violet-50/80 shadow-sm dark:border-violet-400/40 dark:bg-white/[0.07]"
                        : "border-border/70 bg-card/50 hover:border-violet-300/60 hover:bg-violet-50/40 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                        meta.soft
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {option.value === "EMAIL"
                          ? "Rich email"
                          : option.value === "WHATSAPP"
                            ? "Conversational"
                            : "Short & direct"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Campaign type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "BROADCAST", label: "Broadcast", description: "Send once to a segment", icon: Radio },
                  { value: "AUTOMATION", label: "Automation", description: "Triggered journey", icon: Workflow }
                ] as const
              ).map((option) => {
                const Icon = option.icon;
                const active = form.type === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => update({ type: option.value })}
                    className={cn(
                      "flex items-center gap-2.5 rounded-2xl border p-3 text-left transition-all",
                      active
                        ? "border-violet-400/70 bg-violet-50/80 shadow-sm dark:border-violet-400/40 dark:bg-white/[0.07]"
                        : "border-border/70 bg-card/50 hover:border-violet-300/60 dark:border-white/[0.08] dark:bg-white/[0.02]"
                    )}
                  >
                    <Icon className={cn("size-4", active ? "text-violet-600 dark:text-violet-300" : "text-muted-foreground")} />
                    <span>
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Template</Label>
                <Link
                  href="/templates?create=1"
                  className="text-[11px] font-semibold text-violet-600 hover:underline dark:text-violet-300"
                >
                  Manage
                </Link>
              </div>
              <Select
                value={form.templateId}
                onValueChange={(value) => update({ templateId: value })}
                disabled={templatesQuery.isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={templatesQuery.isLoading ? "Loading templates…" : "Choose a template"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template — write content later</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.status !== "PUBLISHED" ? ` · ${titleCase(template.status)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!templatesQuery.isLoading && templates.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  No {channelMeta(form.channel).label} templates yet.{" "}
                  <Link href="/templates?create=1" className="font-semibold text-violet-600 hover:underline dark:text-violet-300">
                    Create one
                  </Link>
                  .
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>Audience segment</Label>
              <Select
                value={form.segmentId}
                onValueChange={(value) => update({ segmentId: value })}
                disabled={segmentsQuery.isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={segmentsQuery.isLoading ? "Loading segments…" : "Choose a segment"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No segment (save as draft)</SelectItem>
                  {segments.map((segment) => (
                    <SelectItem key={segment.id} value={segment.id}>
                      {segment.name}
                      {typeof segment.contactCount === "number" ? ` · ${formatNumber(segment.contactCount)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!segmentsQuery.isLoading && segments.length === 0 ? (
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Filter className="size-3" /> No segments yet — create a segment before launching.
                </p>
              ) : null}
            </div>
          </div>

          {form.channel === "EMAIL" ? (
            <div className="space-y-1.5">
              <Label htmlFor="campaign-subject">Email subject</Label>
              <Input
                id="campaign-subject"
                value={form.subject}
                onChange={(event) => update({ subject: event.target.value })}
                placeholder="A little something for you, {{firstName}}"
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-sender-name">Sender name</Label>
              <Input
                id="campaign-sender-name"
                value={form.senderName}
                onChange={(event) => update({ senderName: event.target.value })}
                placeholder="comGpt Marketing"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-sender-address">Sender address</Label>
              <Input
                id="campaign-sender-address"
                value={form.senderAddress}
                onChange={(event) => update({ senderAddress: event.target.value })}
                placeholder={
                  form.channel === "EMAIL" ? "hello@yourbrand.com" : form.channel === "SMS" ? "+1 555 010 2030" : "+1 555 010 2030"
                }
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="schedule-toggle" className="cursor-pointer">
                  Schedule for later
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create now and let comGpt launch it at the right moment.
                </p>
              </div>
              <Switch id="schedule-toggle" checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
            </div>
            {scheduleEnabled ? (
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="campaign-schedule-at">Launch date &amp; time</Label>
                <Input
                  id="campaign-schedule-at"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => submit("draft")}
              loading={pending && pendingMode === "draft"}
              disabled={pending}
            >
              Save draft
            </Button>
            <Button
              variant="gradient"
              onClick={() => submit(scheduleEnabled ? "schedule" : "launch")}
              loading={pending && (pendingMode === "launch" || pendingMode === "schedule")}
              disabled={pending}
            >
              {scheduleEnabled ? <CalendarClock /> : <Rocket />}
              {scheduleEnabled ? "Schedule campaign" : "Launch now"}
              {!scheduleEnabled ? <Sparkles className="opacity-70" /> : null}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
