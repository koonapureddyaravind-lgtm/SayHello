"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { GitBranch, Sparkles } from "lucide-react";
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
import type { Workflow, WorkflowTriggerType } from "@/lib/types";
import { isWorkflowTriggerType, TRIGGER_META, TRIGGER_OPTIONS } from "./workflow-meta";

export function CreateWorkflowDialog({
  open,
  onOpenChange,
  onCreated
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (workflow: Workflow) => void;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [triggerType, setTriggerType] = React.useState<WorkflowTriggerType>("CONTACT_CREATED");
  const [triggerTag, setTriggerTag] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setTriggerType("CONTACT_CREATED");
    setTriggerTag("");
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<Workflow>("/workflows", {
        method: "POST",
        body: {
          name: name.trim(),
          description: description.trim() || undefined,
          triggerType,
          triggerConfig:
            triggerType === "CONTACT_TAG_ADDED" && triggerTag.trim() ? { tagName: triggerTag.trim() } : {}
        }
      }),
    onSuccess: (workflow) => {
      toast.success("Workflow created", { description: "Your journey is ready to design." });
      onOpenChange(false);
      onCreated(workflow);
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Give your workflow a name");
      return;
    }
    mutation.mutate();
  }

  const trigger = TRIGGER_META[triggerType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-[0_12px_30px_-12px_rgba(124,58,237,0.8)]">
              <Sparkles className="size-5" />
            </div>
            <DialogTitle>Create a workflow</DialogTitle>
            <DialogDescription>
              Start with a trigger, then compose the journey visually in the studio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="workflow-name">Workflow name</Label>
              <Input
                id="workflow-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Welcome & activation"
                required
                maxLength={200}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="workflow-description">Description</Label>
              <Textarea
                id="workflow-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What should this journey accomplish?"
                className="min-h-[78px]"
                maxLength={2000}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="workflow-trigger">Trigger</Label>
              <Select
                value={triggerType}
                onValueChange={(value) => {
                  if (isWorkflowTriggerType(value)) setTriggerType(value);
                }}
              >
                <SelectTrigger id="workflow-trigger">
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
              <p className="glass flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                <GitBranch className="mt-0.5 size-3.5 shrink-0 text-violet-500" />
                {trigger.description}
              </p>
            </div>

            {triggerType === "CONTACT_TAG_ADDED" ? (
              <div className="space-y-1.5 animate-in fade-in-0 slide-in-from-top-1">
                <Label htmlFor="workflow-tag">Trigger tag</Label>
                <Input
                  id="workflow-tag"
                  value={triggerTag}
                  onChange={(event) => setTriggerTag(event.target.value)}
                  placeholder="e.g. vip"
                />
                <p className="text-[10px] text-muted-foreground">Optional — leave blank to run for every tag.</p>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" loading={mutation.isPending}>
              Create workflow
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
