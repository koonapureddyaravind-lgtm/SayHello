"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarClock,
  ShieldBan,
  ShieldCheck,
  Trash2,
  UserRound
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Pagination } from "@/components/common/pagination";
import { StatusBadge } from "@/components/common/status-badge";
import { ChannelBadge } from "@/components/common/channel-badge";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { apiFetch, errorMessage } from "@/lib/api";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  titleCase,
  truncate
} from "@/lib/format";
import type {
  Channel,
  ConsentPurpose,
  ConsentRecord,
  ConsentStatus,
  PageResponse,
  Suppression,
  SuppressionReason
} from "@/lib/types";
import { crmKeys } from "@/components/features/crm/crm-keys";
import { RecordConsentDialog } from "@/components/features/crm/record-consent-dialog";
import { SuppressionDialog } from "@/components/features/crm/suppression-dialog";
import { suppressionRequest } from "@/components/features/crm/suppressions-api";

type ConsentRecordRow = ConsentRecord & { ipAddress?: string | null };

const CHANNEL_FILTERS: { value: Channel | "ALL"; label: string }[] = [
  { value: "ALL", label: "All channels" },
  { value: "EMAIL", label: "Email" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "SMS", label: "SMS" }
];

const STATUS_FILTERS: { value: ConsentStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "GRANTED", label: "Granted" },
  { value: "DENIED", label: "Denied" },
  { value: "WITHDRAWN", label: "Withdrawn" }
];

const PURPOSE_VARIANTS: Record<ConsentPurpose, NonNullable<BadgeProps["variant"]>> = {
  MARKETING: "purple",
  TRANSACTIONAL: "info"
};

const SUPPRESSION_VARIANTS: Record<SuppressionReason, NonNullable<BadgeProps["variant"]>> = {
  UNSUBSCRIBE: "warning",
  HARD_BOUNCE: "danger",
  COMPLAINT: "danger",
  MANUAL: "secondary",
  INVALID: "outline"
};

function evidenceSummary(evidence: Record<string, unknown> | undefined): string | null {
  if (!evidence) return null;
  const note = evidence.note;
  if (typeof note === "string" && note.trim()) return truncate(note, 90);
  const entries = Object.entries(evidence).filter(
    ([, value]) => value !== null && value !== undefined && value !== ""
  );
  if (entries.length === 0) return null;
  return truncate(
    entries
      .map(([key, value]) => {
        const formatted = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
        return `${titleCase(key.replace(/[_-]+/g, " "))}: ${formatted}`;
      })
      .join(" · "),
    90
  );
}

export default function ConsentPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState("consent");

  const [consentPage, setConsentPage] = React.useState(0);
  const [consentSize, setConsentSize] = React.useState(20);
  const [consentChannel, setConsentChannel] = React.useState<Channel | "ALL">("ALL");
  const [consentStatus, setConsentStatus] = React.useState<ConsentStatus | "ALL">("ALL");

  const [suppressionPage, setSuppressionPage] = React.useState(0);
  const [suppressionSize, setSuppressionSize] = React.useState(20);

  const [recordOpen, setRecordOpen] = React.useState(false);
  const [suppressionOpen, setSuppressionOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Suppression | null>(null);

  React.useEffect(() => {
    setConsentPage(0);
  }, [consentChannel, consentStatus]);

  const consentParams = React.useMemo(
    () => ({
      page: consentPage,
      size: consentSize,
      channel: consentChannel === "ALL" ? undefined : consentChannel
    }),
    [consentPage, consentSize, consentChannel]
  );

  const consentQuery = useQuery({
    queryKey: crmKeys.consent.list(consentParams),
    queryFn: () => apiFetch<PageResponse<ConsentRecordRow>>("/consent", { query: consentParams })
  });

  const suppressionsQuery = useQuery({
    queryKey: crmKeys.suppressions.list(suppressionPage, suppressionSize),
    queryFn: () =>
      suppressionRequest<PageResponse<Suppression>>("", {
        query: { page: suppressionPage, size: suppressionSize }
      })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => suppressionRequest<void>(`/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Suppression removed");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: crmKeys.suppressions.all });
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  const consentRecords = consentQuery.data?.items ?? [];
  const visibleConsent =
    consentStatus === "ALL"
      ? consentRecords
      : consentRecords.filter((record) => record.status === consentStatus);
  const consentTotal = consentQuery.data?.totalItems ?? 0;
  const consentPages = consentQuery.data?.totalPages ?? 0;

  const suppressions = suppressionsQuery.data?.items ?? [];
  const suppressionTotal = suppressionsQuery.data?.totalItems ?? 0;
  const suppressionPages = suppressionsQuery.data?.totalPages ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compliance"
        title="Consent & suppression"
        description="Keep an auditable record of permission by channel and purpose, and enforce hard stops across every send."
        actions={
          <>
            <Button
              variant={tab === "consent" ? "gradient" : "outline"}
              onClick={() => setRecordOpen(true)}
            >
              <BadgeCheck /> Record consent
            </Button>
            <Button
              variant={tab === "suppressions" ? "gradient" : "outline"}
              onClick={() => setSuppressionOpen(true)}
            >
              <ShieldBan /> Add suppression
            </Button>
          </>
        }
      />

      <section className="relative overflow-hidden rounded-[30px] bg-[#0b0618] p-6 text-white shadow-float sm:p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 -top-20 size-72 rounded-full bg-violet-600/40 blur-[100px]" />
          <div className="absolute right-1/4 top-1/2 size-64 rounded-full bg-fuchsia-600/25 blur-[100px]" />
          <div className="absolute -bottom-24 right-0 size-72 rounded-full bg-amber-500/15 blur-[100px]" />
          <div className="absolute inset-0 bg-grid-fade bg-[length:40px_40px] opacity-30" />
        </div>

        <div className="relative grid gap-5 lg:grid-cols-[1.15fr_1fr_1fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-white/70 backdrop-blur">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              Compliance ledger
            </span>
            <h2 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight">
              Permission in. <span className="gradient-text">Hard stops out.</span>
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              Consent records capture the proof behind every opt-in. Suppressions enforce opt-outs, bounces and
              complaints before a message leaves the platform.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Consent records</p>
                {consentQuery.isLoading ? (
                  <Skeleton className="mt-1 h-6 w-16 bg-white/10" />
                ) : (
                  <p className="font-display text-xl font-semibold">{formatNumber(consentTotal)}</p>
                )}
              </div>
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-white/45">
              Marketing denials and withdrawals also create a suppression automatically.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md">
                <ShieldBan className="size-4" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Suppressions</p>
                {suppressionsQuery.isLoading ? (
                  <Skeleton className="mt-1 h-6 w-16 bg-white/10" />
                ) : (
                  <p className="font-display text-xl font-semibold">{formatNumber(suppressionTotal)}</p>
                )}
              </div>
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-white/45">
              Expiring entries pause delivery until the date passes; permanent entries never resume.
            </p>
          </div>
        </div>
      </section>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="consent">
            <ShieldCheck /> Consent records
          </TabsTrigger>
          <TabsTrigger value="suppressions">
            <ShieldBan /> Suppressions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="consent" className="mt-4">
          <Card>
            <CardHeader className="gap-4 pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Consent history</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Immutable events by channel and purpose, newest first.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    value={consentChannel}
                    onValueChange={(value) => setConsentChannel(value as Channel | "ALL")}
                  >
                    <SelectTrigger className="sm:w-[160px]" aria-label="Filter consent by channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNEL_FILTERS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={consentStatus}
                    onValueChange={(value) => setConsentStatus(value as ConsentStatus | "ALL")}
                  >
                    <SelectTrigger className="sm:w-[150px]" aria-label="Filter consent by status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_FILTERS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="soft" size="sm" onClick={() => setRecordOpen(true)}>
                    <BadgeCheck /> Record
                  </Button>
                </div>
              </div>
              {consentStatus !== "ALL" ? (
                <p className="text-[11px] text-muted-foreground">
                  Status narrows the current page; use the channel filter for server-side filtering.
                </p>
              ) : null}
            </CardHeader>

            <CardContent className="px-0 pb-0">
              {consentQuery.isLoading ? (
                <div className="space-y-2 px-4 pb-4">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 w-full rounded-2xl" />
                  ))}
                </div>
              ) : consentQuery.isError ? (
                <div className="px-4 pb-4">
                  <ErrorState
                    title="Consent history unavailable"
                    message="We couldn't load consent records for this workspace."
                    onRetry={() => void consentQuery.refetch()}
                  />
                </div>
              ) : consentRecords.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="No consent records yet"
                  description="Record an opt-in, denial or withdrawal to start the audit trail for a contact."
                  action={
                    <Button variant="gradient" size="sm" onClick={() => setRecordOpen(true)}>
                      <BadgeCheck /> Record consent
                    </Button>
                  }
                />
              ) : visibleConsent.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="No records on this page match"
                  description={`The current page has no ${consentStatus.toLowerCase()} records. Clear the status filter or move to another page.`}
                  action={
                    <Button variant="soft" size="sm" onClick={() => setConsentStatus("ALL")}>
                      Clear status filter
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[190px]">Contact</TableHead>
                        <TableHead className="min-w-[110px]">Channel</TableHead>
                        <TableHead className="min-w-[130px]">Purpose</TableHead>
                        <TableHead className="min-w-[120px]">Status</TableHead>
                        <TableHead className="min-w-[140px]">Source</TableHead>
                        <TableHead className="min-w-[200px]">Evidence</TableHead>
                        <TableHead className="min-w-[150px]">Occurred</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleConsent.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <Link
                              href={`/contacts/${record.contactId}`}
                              className="group flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
                                <UserRound className="size-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold group-hover:text-violet-700 dark:group-hover:text-violet-300">
                                  {record.contactName ?? `Contact ${record.contactId.slice(0, 8)}`}
                                </span>
                                <span className="block truncate font-mono text-[10px] text-muted-foreground">
                                  {record.contactId}
                                </span>
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <ChannelBadge channel={record.channel} />
                          </TableCell>
                          <TableCell>
                            <Badge variant={PURPOSE_VARIANTS[record.purpose]}>{titleCase(record.purpose)}</Badge>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={record.status} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <span className="block truncate">{record.source || "—"}</span>
                            {record.ipAddress ? (
                              <span className="block truncate font-mono text-[10px]">{record.ipAddress}</span>
                            ) : null}
                          </TableCell>
                          <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                            {evidenceSummary(record.evidence) ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <span className="block">{formatDateTime(record.occurredAt)}</span>
                            {record.createdAt ? (
                              <span className="block text-[10px]">
                                Logged {formatDate(record.createdAt, "MMM d, yyyy")}
                              </span>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>

            {consentQuery.isSuccess && consentRecords.length > 0 ? (
              <Pagination
                page={consentPage}
                size={consentSize}
                totalItems={consentTotal}
                totalPages={consentPages}
                onPageChange={setConsentPage}
                onSizeChange={(nextSize) => {
                  setConsentSize(nextSize);
                  setConsentPage(0);
                }}
              />
            ) : null}
          </Card>
        </TabsContent>

        <TabsContent value="suppressions" className="mt-4">
          <Card>
            <CardHeader className="gap-3 pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Suppression list</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Addresses that must never receive a matching channel send.
                  </p>
                </div>
                <Button variant="soft" size="sm" onClick={() => setSuppressionOpen(true)}>
                  <ShieldBan /> Add suppression
                </Button>
              </div>
            </CardHeader>

            <CardContent className="px-0 pb-0">
              {suppressionsQuery.isLoading ? (
                <div className="space-y-2 px-4 pb-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 w-full rounded-2xl" />
                  ))}
                </div>
              ) : suppressionsQuery.isError ? (
                <div className="px-4 pb-4">
                  <ErrorState
                    title="Suppressions unavailable"
                    message="We couldn't load the suppression list for this workspace."
                    onRetry={() => void suppressionsQuery.refetch()}
                  />
                </div>
              ) : suppressions.length === 0 ? (
                <EmptyState
                  icon={ShieldBan}
                  title="No suppressions"
                  description="Opt-outs, bounces and complaints will appear here. You can also add an address manually."
                  action={
                    <Button variant="gradient" size="sm" onClick={() => setSuppressionOpen(true)}>
                      <ShieldBan /> Add suppression
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[220px]">Target</TableHead>
                        <TableHead className="min-w-[120px]">Channel</TableHead>
                        <TableHead className="min-w-[140px]">Reason</TableHead>
                        <TableHead className="min-w-[220px]">Note</TableHead>
                        <TableHead className="min-w-[150px]">Expires</TableHead>
                        <TableHead className="min-w-[130px]">Added</TableHead>
                        <TableHead className="w-[60px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suppressions.map((suppression) => (
                        <TableRow key={suppression.id}>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {suppression.email ?? suppression.phone ?? "—"}
                              </p>
                              {suppression.email && suppression.phone ? (
                                <p className="truncate text-xs text-muted-foreground">{suppression.phone}</p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            {suppression.channel ? (
                              <ChannelBadge channel={suppression.channel} />
                            ) : (
                              <Badge variant="secondary">All channels</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={SUPPRESSION_VARIANTS[suppression.reason]}>
                              {titleCase(suppression.reason)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                            {suppression.note ? truncate(suppression.note, 80) : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {suppression.expiresAt ? (
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarClock className="size-3.5" />
                                {formatDateTime(suppression.expiresAt)}
                              </span>
                            ) : (
                              "Permanent"
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(suppression.createdAt, "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-rose-600 dark:hover:text-rose-300"
                              onClick={() => setDeleteTarget(suppression)}
                              aria-label={`Remove suppression for ${suppression.email ?? suppression.phone ?? "address"}`}
                            >
                              <Trash2 />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>

            {suppressionsQuery.isSuccess && suppressions.length > 0 ? (
              <Pagination
                page={suppressionPage}
                size={suppressionSize}
                totalItems={suppressionTotal}
                totalPages={suppressionPages}
                onPageChange={setSuppressionPage}
                onSizeChange={(nextSize) => {
                  setSuppressionSize(nextSize);
                  setSuppressionPage(0);
                }}
              />
            ) : null}
          </Card>
        </TabsContent>
      </Tabs>

      <RecordConsentDialog open={recordOpen} onOpenChange={setRecordOpen} />
      <SuppressionDialog open={suppressionOpen} onOpenChange={setSuppressionOpen} />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Remove this suppression?"
        description={
          deleteTarget
            ? `${deleteTarget.email ?? deleteTarget.phone ?? "This address"} will be eligible to receive ${deleteTarget.channel ? titleCase(deleteTarget.channel) : "all channel"} sends again. Only do this when you have a lawful basis.`
            : undefined
        }
        confirmLabel="Remove suppression"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
