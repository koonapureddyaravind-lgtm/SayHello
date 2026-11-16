"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, Search, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Pagination } from "@/components/common/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardTabs } from "@/components/ui/card-tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TemplateCard } from "@/components/features/campaigns/template-card";
import { TemplateFormDialog } from "@/components/features/campaigns/template-form-dialog";
import { CHANNEL_OPTIONS } from "@/components/features/campaigns/campaign-utils";
import {
  TEMPLATE_STATUS_TABS,
  type TemplateStatusTab
} from "@/components/features/campaigns/templates/template-utils";
import { apiFetch } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import type { Channel, PageResponse, Template } from "@/lib/types";

function TemplateCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 w-full shimmer-bg" />
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <Skeleton className="size-11 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </Card>
  );
}

export default function TemplatesPage() {
  const [channel, setChannel] = React.useState<"ALL" | Channel>("ALL");
  const [status, setStatus] = React.useState<TemplateStatusTab>("ALL");
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Template | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "1") {
      setEditing(null);
      setFormOpen(true);
      params.delete("create");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }
  }, []);

  const templatesQuery = useQuery({
    queryKey: ["templates", "list", { page, size, channel, status, q: debouncedSearch }],
    queryFn: () =>
      apiFetch<PageResponse<Template>>("/templates", {
        query: {
          page,
          size,
          channel: channel === "ALL" ? undefined : channel,
          status: status === "ALL" ? undefined : status,
          q: debouncedSearch || undefined
        }
      })
  });

  const countsQuery = useQuery({
    queryKey: ["templates", "counts"],
    queryFn: () => apiFetch<PageResponse<Template>>("/templates", { query: { page: 0, size: 100 } }),
    staleTime: 60_000
  });

  const counts = React.useMemo(() => {
    const data = countsQuery.data;
    if (!data) return null;
    if (data.totalItems > data.items.length) return null;
    const result: Record<"ALL" | Channel, number> = { ALL: data.totalItems, EMAIL: 0, WHATSAPP: 0, SMS: 0 };
    for (const template of data.items) result[template.channel] += 1;
    return result;
  }, [countsQuery.data]);

  const templates = templatesQuery.data?.items ?? [];
  const activeFilters = channel !== "ALL" || status !== "ALL" || debouncedSearch.length > 0;

  function clearFilters() {
    setChannel("ALL");
    setStatus("ALL");
    setSearch("");
    setDebouncedSearch("");
    setPage(0);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(template: Template) {
    setEditing(template);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Templates"
        title="Message templates"
        description="Reusable content for every channel, with versioning and live variable previews."
        actions={
          <Button variant="gradient" onClick={openCreate}>
            <Plus /> New template
          </Button>
        }
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <CardTabs
          tabs={[
            { value: "ALL", label: "All", count: counts?.ALL },
            ...CHANNEL_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
              count: counts ? counts[option.value] : undefined
            }))
          ]}
          value={channel}
          onValueChange={(value) => {
            setChannel(value as "ALL" | Channel);
            setPage(0);
          }}
          className="w-full xl:w-auto"
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search templates…"
            leftIcon={<Search />}
            className="sm:w-64"
            aria-label="Search templates"
          />
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as TemplateStatusTab);
              setPage(0);
            }}
          >
            <SelectTrigger className="sm:w-[170px]" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_STATUS_TABS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.value === "ALL" ? "All statuses" : option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {templatesQuery.isSuccess ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">
            {formatNumber(templatesQuery.data.totalItems)} template{templatesQuery.data.totalItems === 1 ? "" : "s"}
            {activeFilters ? " matching your filters" : ""}
          </p>
          {activeFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}

      {templatesQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <TemplateCardSkeleton key={index} />
          ))}
        </div>
      ) : templatesQuery.isError ? (
        <ErrorState
          title="Templates are taking a moment"
          message="We couldn't load your template library. Check the filters or try again."
          onRetry={() => void templatesQuery.refetch()}
        />
      ) : templates.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title={activeFilters ? "No templates match those filters" : "Craft your first template"}
            description={
              activeFilters
                ? "Try a different channel, status or search term to find the template you need."
                : "Create once and reuse across broadcasts and automations, with variables that personalize per recipient."
            }
            action={
              activeFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button variant="gradient" onClick={openCreate}>
                  <Sparkles /> Create template
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} onEdit={openEdit} />
          ))}
        </div>
      )}

      {templatesQuery.data && templatesQuery.data.totalItems > 0 ? (
        <Pagination
          page={templatesQuery.data.page}
          totalPages={templatesQuery.data.totalPages}
          totalItems={templatesQuery.data.totalItems}
          size={templatesQuery.data.size}
          onPageChange={setPage}
          onSizeChange={(nextSize) => {
            setSize(nextSize);
            setPage(0);
          }}
        />
      ) : null}

      <TemplateFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        template={editing}
      />
    </div>
  );
}
