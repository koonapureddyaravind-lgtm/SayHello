"use client";

import { Braces, Plus, Trash2, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { channelMeta } from "@/components/common/channel-badge";
import { cn } from "@/lib/cn";
import type { Channel, TemplateVariable } from "@/lib/types";
import { CHANNEL_OPTIONS } from "../campaign-utils";
import { mergeDetectedVariables, type TemplateFormState } from "./template-utils";

export function TemplateFormFields({
  value,
  onChange,
  idPrefix,
  disabled = false
}: {
  value: TemplateFormState;
  onChange: (patch: Partial<TemplateFormState>) => void;
  idPrefix: string;
  disabled?: boolean;
}) {
  const isEmail = value.channel === "EMAIL";

  function updateVariable(index: number, patch: Partial<TemplateVariable>) {
    onChange({
      variables: value.variables.map((variable, variableIndex) =>
        variableIndex === index ? { ...variable, ...patch } : variable
      )
    });
  }

  function addVariable() {
    onChange({ variables: [...value.variables, { name: "", label: "", required: false }] });
  }

  function removeVariable(index: number) {
    onChange({ variables: value.variables.filter((_, variableIndex) => variableIndex !== index) });
  }

  function detectVariables() {
    const next = mergeDetectedVariables(value.variables, [value.subject, value.body, value.htmlBody].join("\n"));
    if (next.length === value.variables.length) {
      toast.info("No new {{variables}} found in the content.");
      return;
    }
    onChange({ variables: next });
    toast.success("Variables detected from your content");
  }

  function selectChannel(channel: Channel) {
    onChange({ channel });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Template name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={value.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Welcome offer"
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Channel</Label>
        <div className="grid grid-cols-3 gap-2">
          {CHANNEL_OPTIONS.map((option) => {
            const meta = channelMeta(option.value);
            const Icon = meta.icon;
            const active = value.channel === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => selectChannel(option.value)}
                disabled={disabled}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition-all disabled:opacity-60",
                  active
                    ? "border-violet-400/70 bg-violet-50/80 shadow-sm dark:border-violet-400/40 dark:bg-white/[0.07]"
                    : "border-border/70 bg-card/50 hover:border-violet-300/60 dark:border-white/[0.08] dark:bg-white/[0.02]"
                )}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                    meta.soft
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="text-xs font-semibold">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isEmail ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-subject`}>Subject line</Label>
          <Input
            id={`${idPrefix}-subject`}
            value={value.subject}
            onChange={(event) => onChange({ subject: event.target.value })}
            placeholder="A little something for you, {{firstName}}"
            disabled={disabled}
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`${idPrefix}-body`}>Body</Label>
          <span className="text-[11px] text-muted-foreground">Use {"{{firstName}}"} for personalisation</span>
        </div>
        <Textarea
          id={`${idPrefix}-body`}
          value={value.body}
          onChange={(event) => onChange({ body: event.target.value })}
          placeholder={"Hi {{firstName}},\n\nWe have something special for you…"}
          className="min-h-[190px] font-mono text-xs leading-relaxed"
          disabled={disabled}
        />
      </div>

      {isEmail ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`${idPrefix}-html`}>HTML body</Label>
            <span className="text-[11px] text-muted-foreground">Optional rich email markup</span>
          </div>
          <Textarea
            id={`${idPrefix}-html`}
            value={value.htmlBody}
            onChange={(event) => onChange({ htmlBody: event.target.value })}
            placeholder="<div style='font-family: sans-serif'>…</div>"
            className="min-h-[130px] font-mono text-xs leading-relaxed"
            disabled={disabled}
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="flex items-center gap-1.5">
            <Braces className="size-3.5" /> Variables
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground dark:bg-white/[0.07]">
              {value.variables.length}
            </span>
          </Label>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={detectVariables} disabled={disabled}>
              <WandSparkles /> Detect
            </Button>
            <Button type="button" variant="soft" size="sm" onClick={addVariable} disabled={disabled}>
              <Plus /> Add
            </Button>
          </div>
        </div>

        {value.variables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 px-4 py-4 text-center text-xs text-muted-foreground dark:border-white/[0.08]">
            No variables yet. Add one manually or let comGpt detect {"{{placeholders}}"} in your content.
          </div>
        ) : (
          <div className="space-y-2">
            {value.variables.map((variable, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-2xl border border-border/70 bg-card/50 p-2.5 dark:border-white/[0.08] dark:bg-white/[0.02] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-center"
              >
                <Input
                  value={variable.name}
                  onChange={(event) => updateVariable(index, { name: event.target.value })}
                  placeholder="firstName"
                  aria-label={`Variable ${index + 1} name`}
                  className="h-9 font-mono text-xs"
                  disabled={disabled}
                />
                <Input
                  value={variable.label ?? ""}
                  onChange={(event) => updateVariable(index, { label: event.target.value })}
                  placeholder="First name"
                  aria-label={`Variable ${index + 1} label`}
                  className="h-9 text-xs"
                  disabled={disabled}
                />
                <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                  <Switch
                    checked={Boolean(variable.required)}
                    onCheckedChange={(checked) => updateVariable(index, { required: checked })}
                    disabled={disabled}
                    aria-label={`Variable ${index + 1} required`}
                  />
                  Required
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeVariable(index)}
                  aria-label={`Remove variable ${index + 1}`}
                  disabled={disabled}
                >
                  <Trash2 className="text-rose-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
