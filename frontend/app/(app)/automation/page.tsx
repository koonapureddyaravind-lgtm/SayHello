"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, GitBranch, Pause, Plus, Rocket, Search, Sparkles, Workflow as WorkflowIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Pagination } from "@/components/common/pagination";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardTabs } from "@/components/ui/card-tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateWorkflowDialog } from "@/components/features/automation/create-workflow-dialog";
import { TestWorkflowDialog } from "@/components/features/automation/test-workflow-dialog";
import { WorkflowCard, type WorkflowAction } from "@/components/features/automation/workflow-card";
import { useDebouncedValue } from "@/components/features/automation/use-debounced-value";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import type { PageResponse, Workflow, WorkflowStatus } from "@/lib/types";

const STATUS_TABS = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Drafts" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" }
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["value"];

const ACTION_MESSAGES: Record<WorkflowAction, string> = {
  activate: "Workflow activated",
  pause: "Workflow paused",
  delete: "Workflow deleted"
};

function WorkflowCardSkeleton() {
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
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    </Card>
  );
}

export default function AutomationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [statusTab, setStatusTab] = React.useState<StatusTab>("ALL");
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 320);
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(12);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [testWorkflow, setTestWorkflow] = React.useState<Workflow | null>(null);
  const [deleteWorkflow, setDeleteWorkflow] = React.useState<Workflow | null>(null);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "1") {
      setCreateOpen(true);
      params.delete("create");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }
  }, []);

  const workflowsQuery = useQuery({
    queryKey: ["workflows", "list", { page, size, statusTab, q: debouncedSearch }],
    queryFn: () =>
      apiFetch<PageResponse<Workflow>>("/workflows", {
        query: {
          page,
          size,
          status: statusTab === "ALL" ? undefined : (statusTab as WorkflowStatus),
          q: debouncedSearch || undefined
        }
      })
  });

  const statsQuery = useQuery({
    queryKey: ["workflows", "stats"],
    queryFn: () => apiFetch<PageResponse<Workflow>>("/workflows", { query: { page: 0, size: 100 } }),
    staleTime: 30_000
  });

  const actionMutation = useMutation({
    mutationFn: async ({ workflow, action }: { workflow: Workflow; action: WorkflowAction }) => {
      if (action === "delete") {
        await apiFetch<void>(`/workflows/${workflow.id}`, { method: "DELETE" });
        return null;
      }
      return apiFetch<Workflow>(`/workflows/${workflow.id}/${action}`, { method: "POST" });
    },
    onSuccess: (_data, variables) => {
      toast.success(ACTION_MESSAGES[variables.action], {
        description:
          variables.action === "delete"
            ? `“${variables.workflow.name}” was removed from your workspace.`
            : `“${variables.workflow.name}” is now ${variables.action === "activate" ? "active" : "paused"}.`
      });
      void queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  const workflows = workflowsQuery.data?.items ?? [];
  const statsItems = statsQuery.data?.items ?? [];
  const totalWorkflows = statsQuery.data?.totalItems ?? statsItems.length;
  const activeCount = statsItems.filter((workflow) => workflow.status === "ACTIVE").length;
  const pausedCount = statsItems.filter((workflow) => workflow.status === "PAUSED").length;
  const draftCount = statsItems.filter((workflow) => workflow.status === "DRAFT").length;
  const activeFilters = statusTab !== "ALL" || debouncedSearch.length > 0;

  const pendingAction = actionMutation.isPending
    ? actionMutation.variables?.action ?? null
    : null;
  const pendingWorkflowId = actionMutation.isPending ? actionMutation.variables?.workflow.id ?? null : null;

  function clearFilters() {
    setStatusTab("ALL");
    setSearch("");
    setPage(0);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Automation"
        title="Automation studio"
        description="Design visual journeys, publish them in one click and watch every contact move through each step."
        actions={
          <Button variant="gradient" onClick={() => setCreateOpen(true)}>
            <Plus /> New workflow
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Workflows"
          value={totalWorkflows}
          icon={WorkflowIcon}
          tone="violet"
          hint="Across your workspace"
          loading={statsQuery.isLoading}
        />
        <StatCard
          label="Active"
          value={activeCount}
          icon={Rocket}
          tone="emerald"
          hint="Listening for triggers"
          loading={statsQuery.isLoading}
        />
        <StatCard
          label="Paused"
          value={pausedCount}
          icon={Pause}
          tone="amber"
          hint="Ready to resume"
          loading={statsQuery.isLoading}
        />
        <StatCard
          label="Drafts"
          value={draftCount}
          icon={FileText}
          tone="sky"
          hint="Waiting to be published"
          loading={statsQuery.isLoading}
        />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <CardTabs
          tabs={STATUS_TABS.map((tab) => ({ value: tab.value, label: tab.label }))}
          value={statusTab}
          onValueChange={(value) => {
            setStatusTab(value as StatusTab);
            setPage(0);
          }}
          className="w-full xl:w-auto"
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search workflows…"
            leftIcon={<Search />}
            className="sm:w-72"
            aria-label="Search workflows"
          />
          <span className="hidden items-center gap-1.5 rounded-xl border border-border/70 bg-card/60 px-3 py-2 text-xs text-muted-foreground sm:inline-flex dark:border-white/[0.08] dark:bg-white/[0.03]">
            <GitBranch className="size-3.5 text-violet-500" />
            Visual builder
          </span>
        </div>
      </div>

      {workflowsQuery.isSuccess ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">
            {formatNumber(workflowsQuery.data.totalItems)} workflow{workflowsQuery.data.totalItems === 1 ? "" : "s"}
            {activeFilters ? " matching your filters" : ""}
          </p>
          {activeFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}

      {workflowsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <WorkflowCardSkeleton key={index} />
          ))}
        </div>
      ) : workflowsQuery.isError ? (
        <ErrorState
          title="Workflows are taking a moment"
          message="We couldn't load your automation workflows. Check the filters or try again."
          onRetry={() => void workflowsQuery.refetch()}
        />
      ) : workflows.length === 0 ? (
        <Card>
          <EmptyState
            icon={WorkflowIcon}
            title={activeFilters ? "No workflows match those filters" : "Design your first journey"}
            description={
              activeFilters
                ? "Try a different status or search term to find the workflow you're looking for."
                : "Start from a trigger, add email, WhatsApp, SMS, waits and conditions, then publish the journey visually."
            }
            action={
              activeFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button variant="gradient" onClick={() => setCreateOpen(true)}>
                  <Sparkles /> Create workflow
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onTest={setTestWorkflow}
              onDelete={setDeleteWorkflow}
              onToggleStatus={(target, action) => actionMutation.mutate({ workflow: target, action })}
              busyAction={pendingWorkflowId === workflow.id ? pendingAction : null}
            />
          ))}
        </div>
      )}

      {workflowsQuery.data && workflowsQuery.data.totalItems > 0 ? (
        <Pagination
          page={workflowsQuery.data.page}
          totalPages={workflowsQuery.data.totalPages}
          totalItems={workflowsQuery.data.totalItems}
          size={workflowsQuery.data.size}
          onPageChange={setPage}
          onSizeChange={(nextSize) => {
            setSize(nextSize);
            setPage(0);
          }}
        />
      ) : null}

      <CreateWorkflowDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(workflow) => router.push(`/automation/${workflow.id}`)}
      />

      <TestWorkflowDialog
        workflow={testWorkflow}
        open={Boolean(testWorkflow)}
        onOpenChange={(open) => {
          if (!open) setTestWorkflow(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteWorkflow)}
        onOpenChange={(open) => {
          if (!open) setDeleteWorkflow(null);
        }}
        title={deleteWorkflow ? `Delete “${deleteWorkflow.name}”?` : "Delete workflow?"}
        description="This archives the workflow and removes it from your list. Existing execution history is retained for auditing."
        confirmLabel="Delete workflow"
        destructive
        loading={actionMutation.isPending && actionMutation.variables?.action === "delete"}
        onConfirm={async () => {
          if (!deleteWorkflow) return;
          try {
            await actionMutation.mutateAsync({ workflow: deleteWorkflow, action: "delete" });
            setDeleteWorkflow(null);
          } catch {
            // The mutation surfaces a toast with the server message.
          }
        }}
      />
    </div>
  );
}
