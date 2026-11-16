"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  Wand2
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Pagination } from "@/components/common/pagination";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDate, formatNumber } from "@/lib/format";
import type { PageResponse, Segment } from "@/lib/types";
import { crmKeys } from "@/components/features/crm/crm-keys";
import { ruleSummary } from "@/components/features/crm/segment-rules";
import { SegmentFormDialog } from "@/components/features/crm/segment-form-dialog";
import { SegmentPreviewDialog } from "@/components/features/crm/segment-preview-dialog";
import { useDebouncedValue } from "@/components/features/crm/use-debounced-value";

export default function SegmentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(12);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingSegment, setEditingSegment] = React.useState<Segment | null>(null);
  const [previewSegment, setPreviewSegment] = React.useState<Segment | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Segment | null>(null);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const params = React.useMemo(
    () => ({ page, size, q: debouncedSearch || undefined }),
    [page, size, debouncedSearch]
  );

  const segmentsQuery = useQuery({
    queryKey: crmKeys.segments.list(params),
    queryFn: () => apiFetch<PageResponse<Segment>>("/segments", { query: params })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/segments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Segment deleted");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: crmKeys.segments.all });
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  const segments = segmentsQuery.data?.items ?? [];
  const totalItems = segmentsQuery.data?.totalItems ?? 0;
  const totalPages = segmentsQuery.data?.totalPages ?? 0;

  function openCreate() {
    setEditingSegment(null);
    setFormOpen(true);
  }

  function openEdit(segment: Segment) {
    setEditingSegment(segment);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Segmentation"
        title="Segments"
        description="Build live audiences from contact data, or curate a static list for a one-off campaign."
        actions={
          <Button variant="gradient" onClick={openCreate}>
            <Plus /> Create segment
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search segments by name…"
          leftIcon={<Search />}
          className="sm:max-w-sm"
          aria-label="Search segments"
        />
        <p className="text-sm text-muted-foreground">
          {segmentsQuery.isSuccess
            ? `${formatNumber(totalItems)} ${totalItems === 1 ? "segment" : "segments"}`
            : "Audiences for campaigns and automations."}
        </p>
      </div>

      {segmentsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-64 w-full rounded-3xl" />
          ))}
        </div>
      ) : segmentsQuery.isError ? (
        <ErrorState
          title="Segments unavailable"
          message="We couldn't load your segments. Check your connection and try again."
          onRetry={() => void segmentsQuery.refetch()}
        />
      ) : segments.length === 0 ? (
        debouncedSearch ? (
          <EmptyState
            icon={Search}
            title="No segments match that search"
            description={`Nothing found for “${debouncedSearch}”. Try a shorter name or clear the search.`}
            action={
              <Button variant="soft" size="sm" onClick={() => setSearch("")}>
                Clear search
              </Button>
            }
            className="rounded-3xl border border-dashed border-border/70 bg-card/50"
          />
        ) : (
          <EmptyState
            icon={Wand2}
            title="Create your first segment"
            description="Combine rules on email, status, tags and attributes to target exactly the right contacts."
            action={
              <Button variant="gradient" size="sm" onClick={openCreate}>
                <Plus /> Create segment
              </Button>
            }
            className="rounded-3xl border border-dashed border-border/70 bg-card/50"
          />
        )
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {segments.map((segment) => {
              const rules = segment.rules ?? [];
              const Icon = segment.type === "DYNAMIC" ? Wand2 : Users;
              const accent =
                segment.type === "DYNAMIC"
                  ? "from-violet-500 to-fuchsia-600"
                  : "from-sky-500 to-blue-600";
              return (
                <Card key={segment.id} interactive className="flex h-full flex-col overflow-hidden">
                  <div className="relative border-b border-border/60 bg-gradient-to-br from-secondary/40 via-card/40 to-card/10 p-5 dark:from-white/[0.05] dark:via-white/[0.02] dark:to-transparent">
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={cn(
                          "flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md",
                          accent
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Badge variant={segment.type === "DYNAMIC" ? "purple" : "outline"}>
                          {segment.type === "DYNAMIC" ? "Dynamic" : "Static"}
                        </Badge>
                        {segment.type === "DYNAMIC" ? (
                          <Badge variant="secondary">Match {segment.matchType.toLowerCase()}</Badge>
                        ) : (
                          <Badge variant="secondary">Curated</Badge>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/segments/${segment.id}`}
                      className="mt-4 block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <h2 className="truncate font-display text-lg font-semibold tracking-tight transition-colors hover:text-violet-700 dark:hover:text-violet-300">
                        {segment.name}
                      </h2>
                    </Link>
                    <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                      {segment.description || "No description yet."}
                    </p>
                  </div>

                  <CardContent className="flex flex-1 flex-col gap-4 p-5">
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="size-4 text-violet-500" />
                        <span className="font-semibold text-foreground">
                          {formatNumber(segment.contactCount ?? 0)}
                        </span>
                        members
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-4" />
                        {formatDate(segment.createdAt)}
                      </span>
                    </div>

                    {segment.type === "DYNAMIC" && rules.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {rules.slice(0, 3).map((rule, index) => (
                          <span
                            key={`${segment.id}-rule-${index}`}
                            className="max-w-full truncate rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground dark:bg-white/[0.04]"
                          >
                            {ruleSummary(rule)}
                          </span>
                        ))}
                        {rules.length > 3 ? (
                          <span className="rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground dark:bg-white/[0.04]">
                            +{rules.length - 3} more
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-dashed border-border/70 px-3 py-2.5 text-[11px] text-muted-foreground">
                        {segment.type === "STATIC"
                          ? "Members are curated by hand on the segment detail page."
                          : "No rules yet — every active contact would match."}
                      </p>
                    )}

                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                      <Link
                        href={`/segments/${segment.id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 transition-colors hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200"
                      >
                        View members <ArrowRight className="size-4" />
                      </Link>
                      <div className="flex items-center gap-0.5">
                        {segment.type === "DYNAMIC" ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setPreviewSegment(segment)}
                            aria-label={`Preview ${segment.name}`}
                          >
                            <Eye />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(segment)}
                          aria-label={`Edit ${segment.name}`}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-rose-600 dark:hover:text-rose-300"
                          onClick={() => setDeleteTarget(segment)}
                          aria-label={`Delete ${segment.name}`}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.035]">
            <Pagination
              page={page}
              size={size}
              totalItems={totalItems}
              totalPages={totalPages}
              onPageChange={setPage}
              onSizeChange={(nextSize) => {
                setSize(nextSize);
                setPage(0);
              }}
              className="border-t-0"
            />
          </div>
        </>
      )}

      <SegmentFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingSegment(null);
        }}
        segment={editingSegment}
      />
      <SegmentPreviewDialog
        open={previewSegment !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewSegment(null);
        }}
        name={previewSegment?.name}
        rules={previewSegment?.rules ?? []}
        matchType={previewSegment?.matchType ?? "ALL"}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this segment?"
        description={
          deleteTarget
            ? `${deleteTarget.name} will be removed. Campaigns that referenced it keep their historical recipients, but new sends cannot target it.`
            : undefined
        }
        confirmLabel="Delete segment"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
