"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Clock3, ListChecks, RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Pagination } from "@/components/common/pagination";
import { StatusBadge } from "@/components/common/status-badge";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { displayName, formatDateTime, formatRelative, initials, toDate } from "@/lib/format";
import type { Contact, PageResponse, WorkflowExecution } from "@/lib/types";

function durationLabel(execution: WorkflowExecution): string {
  const start = toDate(execution.startedAt);
  const finish = toDate(execution.finishedAt);
  if (!finish) {
    if (execution.status === "WAITING") return "Waiting";
    if (execution.status === "RUNNING") return "In progress";
    return "—";
  }
  if (!start) return "—";
  const seconds = Math.max(0, Math.round((finish.getTime() - start.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainder}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function ExecutionsPanel({
  workflowId,
  nodeLabels,
  className
}: {
  workflowId: string;
  nodeLabels?: Record<string, string>;
  className?: string;
}) {
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);

  const executionsQuery = useQuery({
    queryKey: ["workflows", "executions", workflowId, { page, size }],
    queryFn: () =>
      apiFetch<PageResponse<WorkflowExecution>>(`/workflows/${workflowId}/executions`, {
        query: { page, size }
      }),
    enabled: Boolean(workflowId),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      return items.some((item) => item.status === "RUNNING" || item.status === "WAITING") ? 8_000 : false;
    }
  });

  const contactsQuery = useQuery({
    queryKey: ["contacts", "execution-lookup"],
    queryFn: () => apiFetch<PageResponse<Contact>>("/contacts", { query: { page: 0, size: 100 } }),
    staleTime: 60_000
  });

  const contactNames = React.useMemo(() => {
    const map = new Map<string, Contact>();
    for (const contact of contactsQuery.data?.items ?? []) {
      map.set(contact.id, contact);
    }
    return map;
  }, [contactsQuery.data]);

  const executions = executionsQuery.data?.items ?? [];
  const runningCount = executions.filter((item) => item.status === "RUNNING").length;
  const waitingCount = executions.filter((item) => item.status === "WAITING").length;
  const failedCount = executions.filter((item) => item.status === "FAILED").length;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg">
            <ListChecks className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Execution history</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Every run of this workflow, newest first. Waiting runs resume automatically.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {executions.length > 0 ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                <span className="size-1.5 animate-pulse rounded-full bg-sky-500" /> {runningCount} running
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                <Clock3 className="size-3" /> {waitingCount} waiting
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                <AlertCircle className="size-3" /> {failedCount} failed
              </span>
            </>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void executionsQuery.refetch()}
            loading={executionsQuery.isFetching}
            aria-label="Refresh executions"
          >
            <RefreshCw /> Refresh
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {executionsQuery.isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : executionsQuery.isError ? (
          <div className="p-5">
            <ErrorState
              title="Executions are taking a moment"
              message="We couldn't load the execution history for this workflow."
              onRetry={() => void executionsQuery.refetch()}
            />
          </div>
        ) : executions.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No executions yet"
            description="Publish and activate this workflow, or run a test, and every run will be tracked here with its current step and timing."
            className="py-14"
          />
        ) : (
          <TooltipProvider delayDuration={150}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="hidden md:table-cell">Started</TableHead>
                  <TableHead className="hidden sm:table-cell">Duration</TableHead>
                  <TableHead className="hidden lg:table-cell">Current node</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((execution) => {
                  const contact = contactNames.get(execution.contactId);
                  const contactLabel = contact ? displayName(contact) : `Contact ${execution.contactId.slice(0, 8)}`;
                  const nodeKey = execution.currentNodeKey;
                  const nodeLabel = nodeKey ? nodeLabels?.[nodeKey] ?? nodeKey : "—";
                  return (
                    <TableRow key={execution.id}>
                      <TableCell>
                        <StatusBadge status={execution.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar className="size-8">
                            <AvatarFallback className="text-[10px]">
                              {contact ? initials(displayName(contact)) : execution.contactId.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{contactLabel}</p>
                            <p className="truncate text-[10px] text-muted-foreground" title={execution.contactId}>
                              {execution.contactId}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell">
                        <span className="block font-medium text-foreground">{formatDateTime(execution.startedAt)}</span>
                        <span>{formatRelative(execution.startedAt)}</span>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-xs font-medium sm:table-cell">
                        {durationLabel(execution)}
                      </TableCell>
                      <TableCell className="hidden max-w-[180px] lg:table-cell">
                        {nodeKey ? (
                          <span className="block truncate font-mono text-[11px] text-muted-foreground" title={nodeKey}>
                            {nodeLabel}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {execution.errorMessage ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex max-w-[160px] items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                                <AlertCircle className="size-3 shrink-0" />
                                <span className="truncate">{execution.errorMessage}</span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm whitespace-pre-wrap">{execution.errorMessage}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TooltipProvider>
        )}

        {executionsQuery.data && executionsQuery.data.totalItems > 0 ? (
          <Pagination
            page={executionsQuery.data.page}
            totalPages={executionsQuery.data.totalPages}
            totalItems={executionsQuery.data.totalItems}
            size={executionsQuery.data.size}
            onPageChange={setPage}
            onSizeChange={(nextSize) => {
              setSize(nextSize);
              setPage(0);
            }}
          />
        ) : null}
      </Card>
    </div>
  );
}
