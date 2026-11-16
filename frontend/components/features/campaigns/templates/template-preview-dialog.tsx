"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Eye, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChannelBadge } from "@/components/common/channel-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { apiFetch } from "@/lib/api";
import { interpolateTemplate } from "../campaign-utils";
import { initialVariableValues } from "./template-utils";
import { TemplatePreviewPane } from "./template-preview-pane";
import type { Template } from "@/lib/types";

interface PreviewResult {
  subject?: string | null;
  body: string;
  htmlBody?: string | null;
}

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  template
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template;
}) {
  const [values, setValues] = React.useState<Record<string, string>>(() => initialVariableValues(template.variables));
  const [rendered, setRendered] = React.useState<PreviewResult | null>(null);
  const [serverUnavailable, setServerUnavailable] = React.useState(false);

  const previewMutation = useMutation({
    mutationFn: (variables: Record<string, string>) =>
      apiFetch<PreviewResult>(`/templates/${template.id}/preview`, {
        method: "POST",
        body: { variables }
      }),
    onSuccess: (data) => {
      setRendered(data);
      setServerUnavailable(false);
    },
    onError: () => {
      setRendered(null);
      setServerUnavailable(true);
    }
  });

  React.useEffect(() => {
    if (!open) return;
    const initial = initialVariableValues(template.variables);
    setValues(initial);
    setRendered(null);
    setServerUnavailable(false);
    if (template.id) previewMutation.mutate(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template.id]);

  function handleValuesChange(next: Record<string, string>) {
    setValues(next);
    setRendered(null);
  }

  const localSubject = interpolateTemplate(template.subject ?? "", values);
  const localBody = interpolateTemplate(template.body, values);
  const localHtml = interpolateTemplate(template.htmlBody ?? "", values);

  const displaySubject = rendered ? rendered.subject ?? "" : localSubject;
  const displayBody = rendered ? rendered.body : localBody;
  const displayHtml = rendered ? rendered.htmlBody ?? "" : localHtml;
  const source = rendered ? "server" : "local";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
              <Eye className="size-4" />
            </span>
            <span className="min-w-0 truncate">{template.name}</span>
            <ChannelBadge channel={template.channel} />
            <StatusBadge status={template.status} />
          </DialogTitle>
          <DialogDescription>
            Fill in the variables to see exactly what your recipients will receive.
          </DialogDescription>
        </DialogHeader>

        <TemplatePreviewPane
          channel={template.channel}
          subject={displaySubject}
          body={displayBody}
          htmlBody={displayHtml}
          variables={template.variables}
          values={values}
          onValuesChange={handleValuesChange}
          source={source}
        />

        {serverUnavailable && !rendered ? (
          <p className="rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
            Showing a local preview — the preview service is unavailable right now.
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="gradient"
            onClick={() => previewMutation.mutate(values)}
            loading={previewMutation.isPending}
          >
            <RefreshCw /> Render preview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
