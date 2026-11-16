"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, Plus, Trash2, Wand2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { Segment, SegmentRule } from "@/lib/types";
import { crmKeys } from "@/components/features/crm/crm-keys";
import {
  ATTRIBUTE_FIELD_PREFIX,
  RULE_FIELD_OPTIONS,
  RULE_OPERATOR_OPTIONS,
  attributeKeyOf,
  isAttributeRule,
  normalizeRuleField,
  operatorIsMultiValue,
  operatorNeedsValue
} from "@/components/features/crm/segment-rules";

export type SegmentType = "DYNAMIC" | "STATIC";
export type SegmentMatchType = "ALL" | "ANY";

interface RuleDraft {
  id: string;
  field: string;
  attributeKey: string;
  operator: string;
  value: string;
}

interface SegmentPayload {
  name: string;
  description: string;
  type: SegmentType;
  matchType: SegmentMatchType;
  rules: SegmentRule[];
}

const ATTRIBUTE_VALUE = "attribute";

let ruleSequence = 0;

function newRule(overrides: Partial<RuleDraft> = {}): RuleDraft {
  ruleSequence += 1;
  return {
    id: `rule-${Date.now()}-${ruleSequence}`,
    field: "email",
    attributeKey: "",
    operator: "contains",
    value: "",
    ...overrides
  };
}

function draftsFromSegment(segment: Segment | null | undefined): RuleDraft[] {
  if (!segment?.rules?.length) return [newRule()];
  return segment.rules.map((rule) => {
    const field = normalizeRuleField(rule.field);
    const fieldOption = RULE_FIELD_OPTIONS.find((option) => option.value === field);
    const operator = RULE_OPERATOR_OPTIONS.find((option) => option.value === rule.operator)
      ? rule.operator
      : "eq";
    return newRule({
      field: isAttributeRule(field) ? ATTRIBUTE_VALUE : fieldOption ? field : "email",
      attributeKey: isAttributeRule(field) ? attributeKeyOf(field) : "",
      operator,
      value: draftValue(rule.value)
    });
  });
}

function draftValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ruleFieldOf(draft: RuleDraft): string {
  if (draft.field === ATTRIBUTE_VALUE) {
    return `${ATTRIBUTE_FIELD_PREFIX}${draft.attributeKey.trim()}`;
  }
  return normalizeRuleField(draft.field);
}

function buildRule(draft: RuleDraft): SegmentRule {
  const operator = draft.operator;
  let value: unknown;
  if (operatorIsMultiValue(operator)) {
    value = draft.value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  } else if (operatorNeedsValue(operator)) {
    value = draft.value.trim();
  }
  return { field: ruleFieldOf(draft), operator, value };
}

function validateDrafts(drafts: RuleDraft[]): string | null {
  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index];
    if (!draft) continue;
    const position = `Rule ${index + 1}`;
    if (draft.field === ATTRIBUTE_VALUE && !draft.attributeKey.trim()) {
      return `${position} needs an attribute key (for example “plan” or “company.size”).`;
    }
    if (operatorNeedsValue(draft.operator) && !draft.value.trim()) {
      return `${position} needs a value to compare against.`;
    }
    if (operatorIsMultiValue(draft.operator)) {
      const values = draft.value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (values.length === 0) return `${position} needs at least one value.`;
    }
  }
  return null;
}

export function SegmentFormDialog({
  open,
  onOpenChange,
  segment,
  onSaved
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment?: Segment | null;
  onSaved?: (segment: Segment) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<SegmentType>("DYNAMIC");
  const [matchType, setMatchType] = React.useState<SegmentMatchType>("ALL");
  const [rules, setRules] = React.useState<RuleDraft[]>(() => [newRule()]);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setName(segment?.name ?? "");
    setDescription(segment?.description ?? "");
    setType(segment?.type ?? "DYNAMIC");
    setMatchType(segment?.matchType ?? "ALL");
    setRules(draftsFromSegment(segment));
    setFormError(null);
  }, [open, segment]);

  const mutation = useMutation({
    mutationFn: (payload: SegmentPayload) =>
      segment
        ? apiFetch<Segment>(`/segments/${segment.id}`, { method: "PATCH", body: payload })
        : apiFetch<Segment>("/segments", { method: "POST", body: payload }),
    onSuccess: (saved) => {
      toast.success(segment ? "Segment updated" : "Segment created");
      void queryClient.invalidateQueries({ queryKey: crmKeys.segments.all });
      void queryClient.invalidateQueries({ queryKey: crmKeys.segments.detail(saved.id) });
      onSaved?.(saved);
      onOpenChange(false);
    },
    onError: (error) => setFormError(errorMessage(error))
  });

  function updateRule(id: string, patch: Partial<RuleDraft>) {
    setRules((current) => current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  }

  function addRule() {
    setRules((current) => [...current, newRule({ operator: "eq" })]);
  }

  function removeRule(id: string) {
    setRules((current) => (current.length === 1 ? current : current.filter((rule) => rule.id !== id)));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError("Give this segment a name so your team can recognise it.");
      return;
    }
    if (type === "DYNAMIC") {
      const validation = validateDrafts(rules);
      if (validation) {
        setFormError(validation);
        return;
      }
    }
    const compiledRules =
      type === "DYNAMIC" ? rules.map(buildRule) : (segment?.rules ?? []).map((rule) => ({ ...rule }));
    mutation.mutate({
      name: name.trim(),
      description: description.trim(),
      type,
      matchType,
      rules: compiledRules
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{segment ? "Edit segment" : "Create a segment"}</DialogTitle>
          <DialogDescription>
            Dynamic segments evaluate live against contact data. Static segments hold a hand-picked member list.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="segment-name">Name</Label>
              <Input
                id="segment-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="High-intent trial users"
                maxLength={160}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="segment-type">Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as SegmentType)}>
                <SelectTrigger id="segment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DYNAMIC">Dynamic · rules update live</SelectItem>
                  <SelectItem value="STATIC">Static · curated members</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="segment-description">Description</Label>
            <Textarea
              id="segment-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What audience does this segment capture, and how should the team use it?"
              maxLength={1000}
              className="min-h-[84px]"
            />
          </div>

          {type === "STATIC" ? (
            <div className="flex items-start gap-3 rounded-2xl border border-sky-200/70 bg-sky-50/60 p-4 dark:border-sky-500/20 dark:bg-sky-500/10">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md">
                <Info className="size-4" />
              </span>
              <div>
                <p className="font-display text-sm font-semibold">Static segments are curated by hand</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Members stay fixed until you add or remove them from the segment detail page. Rules are not
                  evaluated for static segments.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Label>Audience rules</Label>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Only active contacts can enter a dynamic segment.
                  </p>
                </div>
                <div
                  className="inline-flex rounded-xl bg-secondary/70 p-1 dark:bg-white/[0.05]"
                  role="group"
                  aria-label="Match type"
                >
                  {(["ALL", "ANY"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setMatchType(option)}
                      aria-pressed={matchType === option}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                        matchType === option
                          ? "bg-card text-foreground shadow-sm dark:bg-white/[0.1]"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Match {option.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {rules.map((rule, index) => {
                  const fieldOption = RULE_FIELD_OPTIONS.find((option) => option.value === rule.field);
                  const needsValue = operatorNeedsValue(rule.operator);
                  const multiValue = operatorIsMultiValue(rule.operator);
                  const inputType = rule.field === ATTRIBUTE_VALUE ? "text" : fieldOption?.inputType ?? "text";
                  const valuePlaceholder = multiValue
                    ? "vip, trial, enterprise"
                    : fieldOption?.placeholder ?? "value";
                  return (
                    <div
                      key={rule.id}
                      className="rounded-2xl border border-border/60 bg-secondary/20 p-3 dark:bg-white/[0.02]"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center rounded-full border border-violet-200/70 bg-violet-100/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/15 dark:text-violet-200">
                          {index === 0 ? "Where" : matchType === "ALL" ? "And" : "Or"}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-rose-600 dark:hover:text-rose-300"
                          onClick={() => removeRule(rule.id)}
                          disabled={rules.length === 1}
                          aria-label={`Remove rule ${index + 1}`}
                        >
                          <Trash2 />
                        </Button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <Select
                          value={rule.field}
                          onValueChange={(value) =>
                            updateRule(rule.id, {
                              field: value,
                              operator: value === "tag" && !rule.value ? "eq" : rule.operator
                            })
                          }
                        >
                          <SelectTrigger aria-label={`Rule ${index + 1} field`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RULE_FIELD_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={rule.operator}
                          onValueChange={(value) => updateRule(rule.id, { operator: value })}
                        >
                          <SelectTrigger aria-label={`Rule ${index + 1} operator`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RULE_OPERATOR_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {rule.field === ATTRIBUTE_VALUE ? (
                          <Input
                            value={rule.attributeKey}
                            onChange={(event) => updateRule(rule.id, { attributeKey: event.target.value })}
                            placeholder="attribute key · e.g. plan or company.size"
                            aria-label={`Rule ${index + 1} attribute key`}
                          />
                        ) : (
                          <div className="hidden sm:block" />
                        )}

                        {needsValue ? (
                          <Input
                            type={inputType}
                            value={rule.value}
                            onChange={(event) => updateRule(rule.id, { value: event.target.value })}
                            placeholder={valuePlaceholder}
                            aria-label={`Rule ${index + 1} value`}
                          />
                        ) : (
                          <div className="flex h-11 items-center rounded-xl border border-dashed border-border/70 px-3.5 text-xs text-muted-foreground">
                            This operator checks presence only.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button type="button" variant="soft" size="sm" onClick={addRule}>
                <Plus /> Add rule
              </Button>
            </div>
          )}

          {formError ? (
            <div className="rounded-xl border border-rose-200/70 bg-rose-50/70 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200">
              {formError}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" loading={mutation.isPending}>
              <Wand2 /> {segment ? "Save segment" : "Create segment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
