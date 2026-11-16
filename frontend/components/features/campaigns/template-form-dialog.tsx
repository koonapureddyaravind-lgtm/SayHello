"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, FileText } from "lucide-react";
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
import { apiFetch, errorMessage } from "@/lib/api";
import type { Template } from "@/lib/types";
import { TemplateFormFields } from "./templates/template-form-fields";
import {
  emptyTemplateForm,
  templateToForm,
  toTemplatePayload,
  type TemplateFormState
} from "./templates/template-utils";

export function TemplateFormDialog({
  open,
  onOpenChange,
  template,
  onSaved
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: Template | null;
  onSaved?: (template: Template) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<TemplateFormState>(() => emptyTemplateForm());
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm(template ? templateToForm(template) : emptyTemplateForm());
      setError(null);
    }
  }, [open, template]);

  const saveMutation = useMutation({
    mutationFn: async (nextForm: TemplateFormState) => {
      const payload = toTemplatePayload(nextForm);
      if (template) {
        return apiFetch<Template>(`/templates/${template.id}`, { method: "PATCH", body: payload });
      }
      return apiFetch<Template>("/templates", { method: "POST", body: payload });
    },
    onSuccess: (saved) => {
      toast.success(template ? "Template updated" : "Template created");
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
      onOpenChange(false);
      onSaved?.(saved);
    },
    onError: (mutationError) => toast.error(errorMessage(mutationError))
  });

  function update(patch: Partial<TemplateFormState>) {
    setForm((previous) => ({ ...previous, ...patch }));
  }

  function submit() {
    if (!form.name.trim()) {
      setError("Give your template a name.");
      return;
    }
    if (!form.body.trim() && !form.htmlBody.trim()) {
      setError("Add a text body or HTML content before saving.");
      return;
    }
    setError(null);
    saveMutation.mutate(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
              {template ? <FileText className="size-4" /> : <FilePlus2 className="size-4" />}
            </span>
            {template ? "Edit template" : "New template"}
          </DialogTitle>
          <DialogDescription>
            {template
              ? "Update the content, channel or variables. Saving creates a new revision."
              : "Reusable content for campaigns and automations across one channel."}
          </DialogDescription>
        </DialogHeader>

        <TemplateFormFields value={form} onChange={update} idPrefix="template-dialog" disabled={saveMutation.isPending} />

        {error ? (
          <p className="rounded-xl border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>
            Cancel
          </Button>
          <Button variant="gradient" onClick={submit} loading={saveMutation.isPending}>
            {template ? "Save changes" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
