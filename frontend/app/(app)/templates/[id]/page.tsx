"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Rocket, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { ChannelBadge, channelMeta } from "@/components/common/channel-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TemplateFormFields } from "@/components/features/campaigns/templates/template-form-fields";
import { TemplatePreviewPane } from "@/components/features/campaigns/templates/template-preview-pane";
import { TemplateVersionsList } from "@/components/features/campaigns/templates/template-versions-list";
import {
  emptyTemplateForm,
  initialVariableValues,
  templateToForm,
  toTemplatePayload,
  type TemplateFormState
} from "@/components/features/campaigns/templates/template-utils";
import { interpolateTemplate } from "@/components/features/campaigns/campaign-utils";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Template } from "@/lib/types";

export default function TemplateEditorPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const templateId = Array.isArray(rawId) ? rawId[0] ?? "" : rawId ?? "";
  const queryClient = useQueryClient();

  const [form, setForm] = React.useState<TemplateFormState>(() => emptyTemplateForm());
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  const templateQuery = useQuery({
    queryKey: ["templates", "detail", templateId],
    queryFn: () => apiFetch<Template>(`/templates/${templateId}`),
    enabled: Boolean(templateId)
  });

  const template = templateQuery.data;

  React.useEffect(() => {
    if (!template) return;
    setForm(templateToForm(template));
    setValues(initialVariableValues(template.variables));
    setError(null);
  }, [template]);

  const saveMutation = useMutation({
    mutationFn: ({ id, nextForm }: { id: string; nextForm: TemplateFormState }) =>
      apiFetch<Template>(`/templates/${id}`, { method: "PATCH", body: toTemplatePayload(nextForm) }),
    onSuccess: () => {
      toast.success("Template saved");
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (mutationError) => toast.error(errorMessage(mutationError))
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => apiFetch<Template>(`/templates/${id}/publish`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Template published");
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (mutationError) => toast.error(errorMessage(mutationError))
  });

  function update(patch: Partial<TemplateFormState>) {
    setForm((previous) => ({ ...previous, ...patch }));
  }

  function validate(): boolean {
    if (!form.name.trim()) {
      setError("Give your template a name.");
      return false;
    }
    if (!form.body.trim() && !form.htmlBody.trim()) {
      setError("Add a text body or HTML content before saving.");
      return false;
    }
    setError(null);
    return true;
  }

  async function save() {
    if (!template || !validate()) return;
    try {
      await saveMutation.mutateAsync({ id: template.id, nextForm: form });
    } catch {
      // The mutation surfaces a toast with the server message.
    }
  }

  async function publish() {
    if (!template || !validate()) return;
    const dirty = JSON.stringify(form) !== JSON.stringify(templateToForm(template));
    try {
      if (dirty) {
        await saveMutation.mutateAsync({ id: template.id, nextForm: form });
      }
      await publishMutation.mutateAsync(template.id);
    } catch {
      // The mutations surface toasts with the server message.
    }
  }

  if (!templateId) {
    return (
      <EmptyState
        icon={FileText}
        title="Template not found"
        description="The template link is missing an identifier."
        action={
          <Button asChild variant="gradient">
            <Link href="/templates">
              <ArrowLeft /> Back to templates
            </Link>
          </Button>
        }
      />
    );
  }

  if (templateQuery.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-20 w-full rounded-3xl" />
        <div className="grid gap-4 lg:grid-cols-12">
          <Skeleton className="h-[560px] rounded-3xl lg:col-span-5" />
          <Skeleton className="h-[560px] rounded-3xl lg:col-span-4" />
          <Skeleton className="h-[560px] rounded-3xl lg:col-span-3" />
        </div>
      </div>
    );
  }

  if (templateQuery.isError) {
    return (
      <div className="space-y-5">
        <Button asChild variant="ghost" size="sm">
          <Link href="/templates">
            <ArrowLeft /> Back to templates
          </Link>
        </Button>
        <ErrorState
          title="We couldn't open this template"
          message="The template may have been removed or you may not have access to it."
          onRetry={() => void templateQuery.refetch()}
        />
      </div>
    );
  }

  if (!template) {
    return (
      <EmptyState
        icon={FileText}
        title="Template not found"
        description="This template doesn't exist anymore or the link is no longer valid."
        action={
          <Button asChild variant="gradient">
            <Link href="/templates">
              <ArrowLeft /> Back to templates
            </Link>
          </Button>
        }
      />
    );
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(templateToForm(template));
  const previewVariables = form.variables.filter((variable) => variable.name.trim());
  const previewSubject = interpolateTemplate(form.subject, values);
  const previewBody = interpolateTemplate(form.body, values);
  const previewHtml = form.channel === "EMAIL" ? interpolateTemplate(form.htmlBody, values) : "";
  const saving = saveMutation.isPending || publishMutation.isPending;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link href="/templates">
          <ArrowLeft /> Back to templates
        </Link>
      </Button>

      <PageHeader
        eyebrow="Template editor"
        title={form.name.trim() || template.name}
        description={`${channelMeta(form.channel).label} template · version ${template.currentVersion} · updated ${formatDate(
          template.updatedAt
        )}`}
        actions={
          <>
            <ChannelBadge channel={form.channel} />
            <StatusBadge status={template.status} />
            {dirty ? (
              <Badge variant="warning" className="text-[10px]">
                Unsaved changes
              </Badge>
            ) : null}
            <Button variant="outline" onClick={() => void save()} loading={saveMutation.isPending} disabled={saving}>
              <Save /> Save changes
            </Button>
            {template.status !== "PUBLISHED" ? (
              <Button variant="success" onClick={() => void publish()} loading={publishMutation.isPending} disabled={saving}>
                <Rocket /> Publish
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader className="pb-3">
            <CardTitle>Template settings</CardTitle>
            <CardDescription>Content, channel and personalisation variables.</CardDescription>
          </CardHeader>
          <CardContent>
            <TemplateFormFields value={form} onChange={update} idPrefix="template-editor" disabled={saving} />

            {error ? (
              <p className="mt-4 rounded-xl border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4 dark:border-white/[0.06]">
              <Button variant="gradient" onClick={() => void save()} loading={saveMutation.isPending} disabled={saving}>
                <Save /> Save changes
              </Button>
              {template.status !== "PUBLISHED" ? (
                <Button variant="outline" onClick={() => void publish()} loading={publishMutation.isPending} disabled={saving}>
                  <Rocket /> Publish
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div>
              <CardTitle>Live preview</CardTitle>
              <CardDescription>Updated as you edit.</CardDescription>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              Local
            </Badge>
          </CardHeader>
          <CardContent>
            <TemplatePreviewPane
              channel={form.channel}
              subject={previewSubject}
              body={previewBody}
              htmlBody={previewHtml}
              variables={previewVariables}
              values={values}
              onValuesChange={setValues}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div>
              <CardTitle>Versions</CardTitle>
              <CardDescription>Recent revisions.</CardDescription>
            </div>
            <Badge variant="purple" className="text-[10px]">
              v{template.currentVersion}
            </Badge>
          </CardHeader>
          <CardContent>
            <TemplateVersionsList templateId={template.id} limit={6} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
