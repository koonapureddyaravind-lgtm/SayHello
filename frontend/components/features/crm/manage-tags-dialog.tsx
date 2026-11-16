"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Tag as TagIcon, Tags, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import type { Tag } from "@/lib/types";
import { crmKeys } from "@/components/features/crm/crm-keys";
import { tagVisual } from "@/components/features/crm/contact-visuals";

const TAG_COLORS = ["#7c3aed", "#d946ef", "#ec4899", "#f43f5e", "#fb923c", "#f59e0b", "#10b981", "#0ea5e9"];

function ColorPicker({
  value,
  onChange,
  label
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      {TAG_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            "size-6 rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110",
            value.toLowerCase() === color.toLowerCase() ? "ring-2 ring-violet-500" : "ring-1 ring-black/5 dark:ring-white/10"
          )}
          style={{ background: color }}
          aria-label={`Use ${color}`}
          aria-pressed={value.toLowerCase() === color.toLowerCase()}
        />
      ))}
    </div>
  );
}

export function ManageTagsDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(TAG_COLORS[0] ?? "#7c3aed");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editColor, setEditColor] = React.useState(TAG_COLORS[0] ?? "#7c3aed");
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const tagsQuery = useQuery({
    queryKey: crmKeys.tags,
    queryFn: () => apiFetch<Tag[]>("/tags"),
    enabled: open
  });
  const tags = tagsQuery.data ?? [];

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setColor(TAG_COLORS[0] ?? "#7c3aed");
    setEditingId(null);
    setConfirmDeleteId(null);
    setFormError(null);
  }, [open]);

  function invalidateTags() {
    void queryClient.invalidateQueries({ queryKey: crmKeys.tags });
    void queryClient.invalidateQueries({ queryKey: crmKeys.contacts.all });
  }

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; color: string }) => apiFetch<Tag>("/tags", { method: "POST", body: payload }),
    onSuccess: (tag) => {
      toast.success(`Tag “${tag.name}” created`);
      setName("");
      setFormError(null);
      invalidateTags();
    },
    onError: (error) => setFormError(errorMessage(error))
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; name: string; color: string }) =>
      apiFetch<Tag>(`/tags/${payload.id}`, {
        method: "PATCH",
        body: { name: payload.name, color: payload.color }
      }),
    onSuccess: (tag) => {
      toast.success(`Tag “${tag.name}” updated`);
      setEditingId(null);
      setFormError(null);
      invalidateTags();
    },
    onError: (error) => setFormError(errorMessage(error))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/tags/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Tag deleted");
      setConfirmDeleteId(null);
      setFormError(null);
      invalidateTags();
    },
    onError: (error) => setFormError(errorMessage(error))
  });

  function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setFormError("Give the tag a name first.");
      return;
    }
    createMutation.mutate({ name: name.trim(), color });
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color || (TAG_COLORS[0] ?? "#7c3aed"));
    setConfirmDeleteId(null);
    setFormError(null);
  }

  function submitEdit(id: string) {
    if (!editName.trim()) {
      setFormError("A tag needs a name.");
      return;
    }
    updateMutation.mutate({ id, name: editName.trim(), color: editColor });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage tags</DialogTitle>
          <DialogDescription>
            Tags power filters, segments and campaign audiences. Rename or recolor them without losing history.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submitCreate} className="space-y-3 rounded-2xl border border-border/60 bg-secondary/30 p-3.5 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setFormError(null);
              }}
              placeholder="New tag name"
              maxLength={64}
              aria-label="New tag name"
            />
            <Button type="submit" variant="gradient" loading={createMutation.isPending} disabled={!name.trim()}>
              <Plus /> Add
            </Button>
          </div>
          <ColorPicker value={color} onChange={setColor} label="New tag color" />
        </form>

        {formError ? (
          <p className="rounded-xl border border-rose-200/70 bg-rose-50/70 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200">
            {formError}
          </p>
        ) : null}

        {tagsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : tagsQuery.isError ? (
          <ErrorState
            title="Tags unavailable"
            message="We couldn't load the tag library."
            onRetry={() => void tagsQuery.refetch()}
          />
        ) : tags.length === 0 ? (
          <EmptyState
            icon={Tags}
            title="No tags yet"
            description="Create your first tag above to start grouping contacts."
            className="py-8"
          />
        ) : (
          <div className="space-y-1.5">
            {tags.map((tag) => {
              const editing = editingId === tag.id;
              const confirming = confirmDeleteId === tag.id;
              return (
                <div
                  key={tag.id}
                  className="rounded-2xl border border-border/60 bg-card/60 px-3 py-2.5 transition-colors hover:border-violet-200/70 dark:bg-white/[0.02] dark:hover:border-violet-400/20"
                >
                  {editing ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          className="h-9"
                          maxLength={64}
                          aria-label={`Rename ${tag.name}`}
                        />
                        <Button
                          type="button"
                          variant="soft"
                          size="icon-sm"
                          onClick={() => submitEdit(tag.id)}
                          loading={updateMutation.isPending}
                          aria-label="Save tag"
                        >
                          <Check />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel editing"
                        >
                          <X />
                        </Button>
                      </div>
                      <ColorPicker value={editColor} onChange={setEditColor} label={`Color for ${tag.name}`} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-xl"
                        style={tagVisual(tag.color)}
                      >
                        <TagIcon className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{tag.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatNumber(tag.contactCount ?? 0)} {tag.contactCount === 1 ? "contact" : "contacts"}
                        </p>
                      </div>
                      {confirming ? (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteMutation.mutate(tag.id)}
                            loading={deleteMutation.isPending}
                          >
                            Delete
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => startEdit(tag)}
                            aria-label={`Edit ${tag.name}`}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-rose-600 dark:hover:text-rose-300"
                            onClick={() => {
                              setConfirmDeleteId(tag.id);
                              setEditingId(null);
                            }}
                            aria-label={`Delete ${tag.name}`}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
