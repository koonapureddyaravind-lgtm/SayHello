"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  Filter,
  Globe,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  UserRound,
  X
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Pagination } from "@/components/common/pagination";
import { CopyButton } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatDateTime, formatNumber, formatRelative, truncate } from "@/lib/format";
import type { AuditLog } from "@/lib/types";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { AUDIT_ENTITY_TYPES } from "@/components/features/admin/admin-meta";
import { formatAction, normalizePage, prettyJson } from "@/components/features/admin/admin-utils";

const ALL_ENTITIES = "ALL";

type ActionTone = "secondary" | "success" | "danger" | "info" | "purple";

function actionTone(action: string): ActionTone {
  const normalized = action.toLowerCase();
  if (/(delete|remove|revoke|disable|suspend|cancel)/.test(normalized)) return "danger";
  if (/(create|add|invite|connect|publish|launch|grant|restore)/.test(normalized)) return "success";
  if (/(update|edit|patch|change|rename)/.test(normalized)) return "info";
  if (/(send|schedule|queue|import|export)/.test(normalized)) return "purple";
  return "secondary";
}

function actorLabel(log: AuditLog): string {
  return log.actorName?.trim() || log.actorUserId || "System";
}

function hasSnapshot(value: Record<string, unknown> | null | undefined): value is Record<string, unknown> {
  return Boolean(value && Object.keys(value).length > 0);
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-secondary/30 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 break-all text-xs font-medium", mono && "font-mono")}>{value}</p>
    </div>
  );
}

function SnapshotBlock({
  title,
  value,
  tone
}: {
  title: string;
  value: Record<string, unknown> | null | undefined;
  tone: "before" | "after";
}) {
  const present = hasSnapshot(value);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border",
        tone === "before"
          ? "border-rose-200/70 bg-rose-50/40 dark:border-rose-500/20 dark:bg-rose-500/[0.05]"
          : "border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-500/20 dark:bg-emerald-500/[0.05]"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-inherit px-3.5 py-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
        {present ? <CopyButton value={prettyJson(value)} label="Copy JSON" /> : null}
      </div>
      {present ? (
        <pre className="max-h-64 overflow-auto p-3.5 font-mono text-[11px] leading-relaxed text-foreground/90">
          {prettyJson(value)}
        </pre>
      ) : (
        <p className="px-3.5 py-8 text-center text-xs text-muted-foreground">No snapshot recorded.</p>
      )}
    </div>
  );
}

export function AuditView() {
  const { currentOrganization } = useWorkspace();
  const organizationId = currentOrganization?.id;

  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(20);
  const [action, setAction] = React.useState("");
  const [entityType, setEntityType] = React.useState(ALL_ENTITIES);
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<AuditLog | null>(null);

  const debouncedAction = useDebouncedValue(action.trim(), 350);

  const auditQuery = useQuery({
    queryKey: ["audit-logs", organizationId, page, size, debouncedAction, entityType],
    queryFn: () =>
      apiFetch<unknown>("/audit-logs", {
        query: {
          page,
          size,
          action: debouncedAction || undefined,
          entityType: entityType === ALL_ENTITIES ? undefined : entityType
        }
      }),
    enabled: Boolean(organizationId)
  });

  const auditPage = React.useMemo(() => normalizePage<AuditLog>(auditQuery.data, size), [auditQuery.data, size]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedAction, entityType]);

  React.useEffect(() => {
    if (auditPage.paginated && auditPage.totalPages > 0 && page > auditPage.totalPages - 1) {
      setPage(auditPage.totalPages - 1);
    }
  }, [auditPage.paginated, auditPage.totalPages, page]);

  const visibleItems = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return auditPage.items;

    return auditPage.items.filter((log) => {
      const haystack = [
        log.action,
        log.entityType,
        log.entityId,
        log.actorName,
        log.actorUserId,
        log.ipAddress
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [auditPage.items, search]);

  const hasFilters = action.trim().length > 0 || entityType !== ALL_ENTITIES || search.trim().length > 0;

  function clearFilters() {
    setAction("");
    setEntityType(ALL_ENTITIES);
    setSearch("");
    setPage(0);
  }

  if (!organizationId) {
    return (
      <ErrorState
        title="No workspace selected"
        message="Choose a workspace from the sidebar to review its audit history."
      />
    );
  }

  const totalItems = auditPage.totalItems;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Audit log"
        description="A tamper-evident trail of who changed what across campaigns, contacts, billing and workspace administration."
        actions={
          <Button variant="outline" onClick={() => void auditQuery.refetch()} loading={auditQuery.isFetching}>
            <RefreshCw /> Refresh
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_200px_auto]">
            <div className="space-y-1.5">
              <label htmlFor="audit-search" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Search this page
              </label>
              <Input
                id="audit-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Actor, entity, IP or action…"
                leftIcon={<Search />}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="audit-action" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Action
              </label>
              <Input
                id="audit-action"
                value={action}
                onChange={(event) => setAction(event.target.value)}
                placeholder="campaign.launch"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Entity type
              </label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger aria-label="Filter by entity type">
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ENTITIES}>All entities</SelectItem>
                  {AUDIT_ENTITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" className="w-full lg:w-auto" onClick={clearFilters} disabled={!hasFilters}>
                <X /> Clear
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <Badge variant="secondary">{formatNumber(totalItems)} entries</Badge>
            {hasFilters ? (
              <Badge variant="outline">
                {formatNumber(visibleItems.length)} shown on this page
              </Badge>
            ) : null}
            <span className="flex items-center gap-1.5">
              <Filter className="size-3" />
              Action matches exactly; search filters the entries already on this page.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 py-4 dark:border-white/[0.06]">
          <div>
            <CardTitle className="text-base">Activity</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Newest first · {size} rows per page
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-200">
            <ShieldCheck className="size-3" /> Workspace scoped
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {auditQuery.isLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : auditQuery.isError ? (
            <div className="p-6">
              <ErrorState
                title="Audit history is unavailable"
                message={errorMessage(auditQuery.error)}
                onRetry={() => void auditQuery.refetch()}
              />
            </div>
          ) : auditPage.items.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No audit activity yet"
              description="Administrative changes, campaign launches and billing events will appear here as your team works."
            />
          ) : visibleItems.length === 0 ? (
            <EmptyState
              icon={Filter}
              title="No entries match your search"
              description="Search filters the current page only. Clear the search or move to another page to keep looking."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  <X /> Clear filters
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="hidden lg:table-cell">IP address</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleItems.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      <time
                        dateTime={log.createdAt}
                        title={formatDateTime(log.createdAt)}
                        className="cursor-help text-xs text-muted-foreground underline decoration-dotted underline-offset-4"
                      >
                        {formatRelative(log.createdAt)}
                      </time>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-brand-gradient-soft text-violet-600 dark:text-violet-300">
                          <UserRound className="size-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="max-w-[160px] truncate text-xs font-semibold" title={actorLabel(log)}>
                            {truncate(actorLabel(log), 28)}
                          </p>
                          {log.actorName && log.actorUserId ? (
                            <p className="max-w-[160px] truncate font-mono text-[10px] text-muted-foreground">
                              {truncate(log.actorUserId, 18)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={actionTone(log.action)} className="max-w-[200px] font-mono text-[10px] font-medium">
                        <span className="truncate">{log.action}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">{log.entityType || "—"}</p>
                        <p className="max-w-[160px] truncate font-mono text-[10px] text-muted-foreground">
                          {truncate(log.entityId, 22) || "—"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="font-mono text-[11px] text-muted-foreground">{log.ipAddress || "—"}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(log)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {auditPage.paginated && auditPage.totalItems > 0 ? (
          <Pagination
            page={auditPage.page}
            totalPages={auditPage.totalPages}
            totalItems={auditPage.totalItems}
            size={auditPage.size}
            onPageChange={setPage}
            onSizeChange={(nextSize) => {
              setSize(nextSize);
              setPage(0);
            }}
          />
        ) : null}
      </Card>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {selected ? (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle>{formatAction(selected.action)}</DialogTitle>
                  <Badge variant={actionTone(selected.action)} className="font-mono text-[10px]">
                    {selected.action}
                  </Badge>
                </div>
                <DialogDescription>
                  {selected.entityType}
                  {selected.entityId ? ` · ${selected.entityId}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <DetailField label="Timestamp" value={formatDateTime(selected.createdAt)} />
                <DetailField label="Actor" value={actorLabel(selected)} mono={Boolean(selected.actorUserId)} />
                <DetailField label="Entity type" value={selected.entityType || "—"} />
                <DetailField label="Entity ID" value={selected.entityId || "—"} mono />
                <DetailField label="IP address" value={selected.ipAddress || "—"} mono />
                <DetailField label="Log ID" value={selected.id} mono />
              </div>

              {selected.userAgent ? (
                <div className="flex items-start gap-2.5 rounded-2xl border border-border/70 bg-secondary/30 px-4 py-3 text-xs text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.03]">
                  <Globe className="mt-0.5 size-3.5 shrink-0 text-violet-500" />
                  <span className="break-all">{selected.userAgent}</span>
                </div>
              ) : null}

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <CalendarClock className="size-3.5" />
                Snapshots show the record before and after this change.
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <SnapshotBlock title="Before" value={selected.beforeState} tone="before" />
                <SnapshotBlock title="After" value={selected.afterState} tone="after" />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
