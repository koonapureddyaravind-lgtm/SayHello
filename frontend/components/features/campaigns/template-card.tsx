"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  EllipsisVertical,
  ExternalLink,
  Eye,
  History,
  Pencil,
  Rocket,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ChannelIcon, channelMeta } from "@/components/common/channel-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { apiFetch, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDate, truncate } from "@/lib/format";
import type { Template } from "@/lib/types";
import { TemplatePreviewDialog } from "./templates/template-preview-dialog";
import { TemplateVersionsDialog } from "./templates/template-versions-dialog";
import { normalizeTemplateVariables } from "./templates/template-utils";

export function TemplateCard({
  template,
  onEdit
}: {
  template: Template;
  onEdit: (template: Template) => void;
}) {
  const queryClient = useQueryClient();
  const meta = channelMeta(template.channel);
  const variables = normalizeTemplateVariables(template.variables);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [versionsOpen, setVersionsOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const publishMutation = useMutation({
    mutationFn: () => apiFetch<Template>(`/templates/${template.id}/publish`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Template published");
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch<void>(`/templates/${template.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Template deleted");
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
      setDeleteOpen(false);
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  return (
    <>
      <Card interactive className="group flex h-full flex-col overflow-hidden">
        <div className={cn("h-1.5 w-full bg-gradient-to-r", meta.soft)} />

        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start gap-3">
            <ChannelIcon channel={template.channel} className="size-11 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <Link
                href={`/templates/${template.id}`}
                className="block truncate font-display text-base font-semibold tracking-tight transition-colors hover:text-violet-600 dark:hover:text-violet-300"
              >
                {template.name}
              </Link>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={template.status} />
                <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                  v{template.currentVersion}
                </Badge>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${template.name}`}>
                  <EllipsisVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>{meta.label} template</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href={`/templates/${template.id}`}>
                    <ExternalLink /> Open editor
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEdit(template)}>
                  <Pencil /> Edit details
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPreviewOpen(true)}>
                  <Eye /> Preview
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setVersionsOpen(true)}>
                  <History /> Version history
                </DropdownMenuItem>
                {template.status !== "PUBLISHED" ? (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      publishMutation.mutate();
                    }}
                  >
                    <Rocket className="text-violet-500" /> Publish
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {template.channel === "EMAIL" && template.subject?.trim() ? (
            <div className="mt-3 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Subject</p>
              <p className="mt-0.5 truncate text-xs font-medium">{template.subject}</p>
            </div>
          ) : null}

          <p className="mt-3 line-clamp-3 min-h-[3rem] whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {template.body.trim() || "No body content yet."}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {variables.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">No variables</span>
            ) : (
              <>
                {variables.slice(0, 3).map((variable) => (
                  <Badge
                    key={variable.name}
                    variant="secondary"
                    className="px-2 py-0 text-[10px] font-mono"
                    title={variable.label}
                  >
                    {`{{${variable.name}}}`}
                  </Badge>
                ))}
                {variables.length > 3 ? (
                  <Badge variant="outline" className="px-2 py-0 text-[10px]">
                    +{variables.length - 3}
                  </Badge>
                ) : null}
              </>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3 dark:border-white/[0.06]">
            <span className="text-[11px] text-muted-foreground">Updated {formatDate(template.updatedAt)}</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setPreviewOpen(true)}
                aria-label={`Preview ${template.name}`}
              >
                <Eye className="size-4" />
              </Button>
              <Button variant="soft" size="sm" onClick={() => onEdit(template)}>
                <Pencil /> Edit
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <TemplatePreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} template={template} />
      <TemplateVersionsDialog open={versionsOpen} onOpenChange={setVersionsOpen} template={template} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete “${template.name}”?`}
        description={`This permanently removes the template and its ${template.currentVersion} ${
          template.currentVersion === 1 ? "version" : "versions"
        }. Campaigns using it may lose their content source.`}
        confirmLabel="Delete template"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          try {
            await deleteMutation.mutateAsync();
          } catch {
            // The mutation surfaces a toast with the server message.
          }
        }}
      >
        <p className="rounded-xl border border-border/70 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.03]">
          {truncate(template.body, 120) || "No content"}
        </p>
      </ConfirmDialog>
    </>
  );
}
