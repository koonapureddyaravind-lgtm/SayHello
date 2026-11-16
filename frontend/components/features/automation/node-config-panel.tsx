"use client";

import { CircleStop, Info, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import type { WorkflowNodeConfig } from "@/lib/types";
import type { StudioNode } from "./studio-types";
import {
  configNumber,
  configString,
  isWorkflowTriggerType,
  NODE_META_BY_KIND,
  TRIGGER_META,
  TRIGGER_OPTIONS
} from "./workflow-meta";

const CONDITION_FIELDS = [
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "email", label: "Email address" },
  { value: "phone", label: "Phone number" },
  { value: "status", label: "Contact status" }
];

const CONDITION_OPERATORS = [
  { value: "exists", label: "Exists" },
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "gt", label: "Greater than" },
  { value: "gte", label: "Greater than or equal" },
  { value: "lt", label: "Less than" },
  { value: "lte", label: "Less than or equal" }
];

const WAIT_UNITS = [
  { value: "MINUTES", label: "Minutes" },
  { value: "HOURS", label: "Hours" },
  { value: "DAYS", label: "Days" }
];

export function NodeConfigPanel({
  node,
  onConfigChange,
  onDelete,
  onClose,
  className
}: {
  node: StudioNode | null;
  onConfigChange: (nodeId: string, config: WorkflowNodeConfig) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
  className?: string;
}) {
  if (!node) {
    return (
      <aside
        className={cn(
          "flex flex-col rounded-3xl border border-border/70 bg-card/80 p-5 shadow-card backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.035]",
          className
        )}
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="size-4 text-violet-500" /> Inspector
        </div>
        <div className="flex flex-1 flex-col items-center justify-center py-14 text-center">
          <div className="relative mb-4">
            <div className="absolute inset-0 -z-10 rounded-full bg-brand-gradient opacity-20 blur-2xl" />
            <div className="flex size-14 items-center justify-center rounded-2xl border border-white/40 bg-brand-gradient-soft dark:border-white/10">
              <SlidersHorizontal className="size-6 text-violet-600 dark:text-violet-300" />
            </div>
          </div>
          <p className="font-display text-sm font-semibold">Select a node</p>
          <p className="mt-1.5 max-w-[220px] text-xs leading-relaxed text-muted-foreground">
            Click any block on the canvas to edit its message, timing, condition or destination.
          </p>
          <div className="mt-4 flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/40 px-3 py-1 text-[10px] font-medium text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.04]">
            <Info className="size-3" /> Changes are local until you publish
          </div>
        </div>
      </aside>
    );
  }

  const meta = NODE_META_BY_KIND[node.data.kind] ?? NODE_META_BY_KIND.end;
  const Icon = meta.icon;
  const config = node.data.config ?? {};
  const update = (patch: Partial<WorkflowNodeConfig>) => onConfigChange(node.id, { ...config, ...patch });
  const triggerType = isWorkflowTriggerType(config.triggerType) ? config.triggerType : "CONTACT_CREATED";
  const conditionField = configString(config, "field") || "email";
  const conditionOperator = configString(config, "operator") || "eq";
  const waitUnit = configString(config, "unit") || "HOURS";

  return (
    <aside
      className={cn(
        "flex max-h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-card backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.035]",
        className
      )}
    >
      <div className={cn("relative overflow-hidden bg-gradient-to-r px-4 py-3.5 text-white", meta.gradient)}>
        <span className="pointer-events-none absolute -right-8 -top-10 size-24 rounded-full bg-white/20 blur-2xl" />
        <div className="relative flex items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold">{node.data.label}</p>
            <p className="truncate text-[10px] text-white/70">{meta.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            aria-label="Close inspector"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {node.data.kind === "trigger" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="trigger-type">Trigger event</Label>
                <Select
                  value={triggerType}
                  onValueChange={(value) => {
                    if (isWorkflowTriggerType(value)) update({ triggerType: value });
                  }}
                >
                  <SelectTrigger id="trigger-type" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] leading-relaxed text-muted-foreground">{TRIGGER_META[triggerType].description}</p>
              </div>

              {triggerType === "CONTACT_TAG_ADDED" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="trigger-tag">Tag name</Label>
                  <Input
                    id="trigger-tag"
                    value={configString(config, "tagName")}
                    onChange={(event) => update({ tagName: event.target.value })}
                    placeholder="e.g. vip"
                  />
                  <p className="text-[10px] text-muted-foreground">Leave blank to start for every contact tag.</p>
                </div>
              ) : null}

              {triggerType === "WEBHOOK" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="trigger-webhook">Webhook signing secret</Label>
                  <Input
                    id="trigger-webhook"
                    value={configString(config, "secret")}
                    onChange={(event) => update({ secret: event.target.value })}
                    placeholder="Optional — configured in integrations"
                  />
                </div>
              ) : null}

              <div className="rounded-2xl border border-border/60 bg-secondary/30 p-3 text-[10px] leading-relaxed text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.03]">
                This trigger is saved when you publish the graph. Test runs ignore the trigger event and start from the
                trigger node.
              </div>
            </>
          ) : null}

          {node.data.kind === "send_email" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="email-template">Template ID</Label>
                <Input
                  id="email-template"
                  value={configString(config, "templateId")}
                  onChange={(event) => update({ templateId: event.target.value })}
                  placeholder="Optional template UUID"
                />
                <p className="text-[10px] text-muted-foreground">When set, the template content is rendered for the contact.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email-subject">Subject</Label>
                <Input
                  id="email-subject"
                  value={configString(config, "subject")}
                  onChange={(event) => update({ subject: event.target.value })}
                  placeholder="Welcome to {{organization}}"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email-body">Email body</Label>
                <Textarea
                  id="email-body"
                  value={configString(config, "body")}
                  onChange={(event) => update({ body: event.target.value })}
                  placeholder="Write the message your contact will receive…"
                  className="min-h-[150px]"
                />
                <p className="text-[10px] text-muted-foreground">You can use contact variables like {"{{firstName}}"}</p>
              </div>
            </>
          ) : null}

          {node.data.kind === "send_whatsapp" || node.data.kind === "send_sms" ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${node.id}-body`}>
                {node.data.kind === "send_whatsapp" ? "WhatsApp message" : "SMS message"}
              </Label>
              <Textarea
                id={`${node.id}-body`}
                value={configString(config, "body")}
                onChange={(event) => update({ body: event.target.value })}
                placeholder={
                  node.data.kind === "send_whatsapp"
                    ? "Hey {{firstName}}, we have something new for you…"
                    : "Hi {{firstName}}, quick update from our team."
                }
                className="min-h-[170px]"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Personalize with {"{{firstName}}"} and contact attributes.</span>
                <span className="font-semibold">{configString(config, "body").length} chars</span>
              </div>
            </div>
          ) : null}

          {node.data.kind === "wait" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="wait-amount">Wait for</Label>
                <div className="grid grid-cols-[1fr_1.2fr] gap-2">
                  <Input
                    id="wait-amount"
                    type="number"
                    min={1}
                    value={configNumber(config, "amount", 1)}
                    onChange={(event) => update({ amount: event.target.value === "" ? 1 : Number(event.target.value) })}
                  />
                  <Select value={waitUnit} onValueChange={(value) => update({ unit: value as WorkflowNodeConfig["unit"] })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WAIT_UNITS.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-2xl border border-cyan-200/60 bg-cyan-50/70 p-3 text-[10px] leading-relaxed text-cyan-800 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200">
                The execution pauses and resumes automatically after the delay. Waiting runs stay visible in the
                executions tab.
              </div>
            </>
          ) : null}

          {node.data.kind === "condition" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="condition-field">Contact field</Label>
                <Select value={conditionField} onValueChange={(value) => update({ field: value })}>
                  <SelectTrigger id="condition-field" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_FIELDS.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="condition-operator">Operator</Label>
                <Select value={conditionOperator} onValueChange={(value) => update({ operator: value })}>
                  <SelectTrigger id="condition-operator" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPERATORS.map((operator) => (
                      <SelectItem key={operator.value} value={operator.value}>
                        {operator.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {conditionOperator !== "exists" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="condition-value">Value</Label>
                  <Input
                    id="condition-value"
                    value={configString(config, "value")}
                    onChange={(event) => update({ value: event.target.value })}
                    placeholder="e.g. active"
                  />
                </div>
              ) : null}
              <div className="rounded-2xl border border-fuchsia-200/60 bg-fuchsia-50/70 p-3 text-[10px] leading-relaxed text-fuchsia-800 dark:border-fuchsia-400/20 dark:bg-fuchsia-500/10 dark:text-fuchsia-200">
                Connect the True and False handles on the canvas to different branches.
              </div>
            </>
          ) : null}

          {node.data.kind === "add_tag" ? (
            <div className="space-y-1.5">
              <Label htmlFor="tag-name">Tag name</Label>
              <Input
                id="tag-name"
                value={configString(config, "tagName")}
                onChange={(event) => update({ tagName: event.target.value })}
                placeholder="e.g. engaged"
              />
              <p className="text-[10px] text-muted-foreground">The tag is created for the contact when this node runs.</p>
            </div>
          ) : null}

          {node.data.kind === "webhook" ? (
            <div className="space-y-1.5">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                type="url"
                value={configString(config, "url")}
                onChange={(event) => update({ url: event.target.value })}
                placeholder="https://api.example.com/hooks/omniflow"
              />
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                We send the contact and journey context as a JSON POST. A non-2xx response fails the execution.
              </p>
            </div>
          ) : null}

          {node.data.kind === "end" ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border/70 bg-secondary/30 px-4 py-8 text-center dark:border-white/[0.08] dark:bg-white/[0.03]">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-md">
                <CircleStop className="size-5" />
              </span>
              <p className="mt-3 font-display text-sm font-semibold">Journey complete</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                This node finishes the execution. No further configuration is needed.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-3 dark:border-white/[0.06]">
        <span className="text-[10px] text-muted-foreground">Node ID · {node.id.slice(0, 12)}</span>
        <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-500/10" onClick={() => onDelete(node.id)}>
          <Trash2 /> Remove
        </Button>
      </div>
    </aside>
  );
}
