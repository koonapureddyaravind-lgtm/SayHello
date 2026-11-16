"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Eye,
  Pencil,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
  Wand2
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Pagination } from "@/components/common/pagination";
import { StatusBadge } from "@/components/common/status-badge";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { ApiClientError, apiFetch, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  displayName,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
  titleCase
} from "@/lib/format";
import type { Contact, PageResponse, Segment } from "@/lib/types";
import { crmKeys } from "@/components/features/crm/crm-keys";
import { ContactAvatar } from "@/components/features/crm/contact-visuals";
import { describeRule } from "@/components/features/crm/segment-rules";
import { SegmentFormDialog } from "@/components/features/crm/segment-form-dialog";
import { SegmentPreviewDialog } from "@/components/features/crm/segment-preview-dialog";
import { SegmentMembersDialog } from "@/components/features/crm/segment-members-dialog";

const MEMBER_SIZE = 20;

export default function SegmentDetailPage() {
  const params = useParams<{ id: string }>();
  const segmentId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [memberPage, setMemberPage] = React.useState(0);
  const [editOpen, setEditOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [membersOpen, setMembersOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    setMemberPage(0);
  }, [segmentId]);

  const segmentQuery = useQuery({
    queryKey: crmKeys.segments.detail(segmentId),
    queryFn: () => apiFetch<Segment>(`/segments/${segmentId}`),
    enabled: Boolean(segmentId)
  });

  const membersQuery = useQuery({
    queryKey: crmKeys.segments.members(segmentId, memberPage, MEMBER_SIZE),
    queryFn: () =>
      apiFetch<PageResponse<Contact>>(`/segments/${segmentId}/members`, {
        query: { page: memberPage, size: MEMBER_SIZE }
      }),
    enabled: Boolean(segmentId)
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch<void>(`/segments/${segmentId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Segment deleted");
      void queryClient.invalidateQueries({ queryKey: crmKeys.segments.all });
      router.push("/segments");
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  if (segmentQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-48 w-full rounded-[30px]" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 w-full rounded-3xl" />
          <Skeleton className="h-64 w-full rounded-3xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (segmentQuery.isError || !segmentQuery.data) {
    const notFound = segmentQuery.error instanceof ApiClientError && segmentQuery.error.status === 404;
    return (
      <div className="space-y-6">
        <Link
          href="/segments"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All segments
        </Link>
        <ErrorState
          title={notFound ? "Segment not found" : "Segment unavailable"}
          message={
            notFound
              ? "This segment may have been deleted or belongs to another workspace."
              : "We couldn't load this segment. Try again in a moment."
          }
          onRetry={notFound ? undefined : () => void segmentQuery.refetch()}
        />
      </div>
    );
  }

  const segment = segmentQuery.data;
  const rules = segment.rules ?? [];
  const members = membersQuery.data?.items ?? [];
  const totalMembers = membersQuery.data?.totalItems ?? segment.contactCount ?? 0;
  const totalPages = membersQuery.data?.totalPages ?? 0;
  const Icon = segment.type === "DYNAMIC" ? Wand2 : Users;
  const accent =
    segment.type === "DYNAMIC" ? "from-violet-500 to-fuchsia-600" : "from-sky-500 to-blue-600";

  return (
    <div className="space-y-6">
      <Link
        href="/segments"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All segments
      </Link>

      <section className="relative overflow-hidden rounded-[30px] bg-[#0b0618] p-6 text-white shadow-float sm:p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 -top-20 size-72 rounded-full bg-violet-600/40 blur-[100px]" />
          <div className="absolute right-1/4 top-1/2 size-64 rounded-full bg-fuchsia-600/25 blur-[100px]" />
          <div className="absolute -bottom-24 right-0 size-72 rounded-full bg-amber-500/15 blur-[100px]" />
          <div className="absolute inset-0 bg-grid-fade bg-[length:40px_40px] opacity-30" />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span
              className={cn(
                "flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg sm:size-16",
                accent
              )}
            >
              <Icon className="size-6 sm:size-7" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={segment.type === "DYNAMIC" ? "purple" : "outline"}>
                  {segment.type === "DYNAMIC" ? "Dynamic" : "Static"}
                </Badge>
                {segment.type === "DYNAMIC" ? (
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-semibold text-white/70">
                    Match {segment.matchType.toLowerCase()}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-semibold text-white/70">
                    Curated list
                  </span>
                )}
              </div>
              <h1 className="mt-3 truncate font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                {segment.name}
              </h1>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/55">
                {segment.description || "No description yet."}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium text-white/60">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5">
                  <Users className="size-3" />
                  {formatNumber(totalMembers)} members
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5">
                  <CalendarDays className="size-3" />
                  Created {formatDate(segment.createdAt)}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5">
                  Updated {formatRelative(segment.updatedAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {segment.type === "DYNAMIC" ? (
              <Button
                variant="outline"
                className="border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.12] hover:text-white dark:border-white/15 dark:bg-white/[0.06]"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye /> Preview
              </Button>
            ) : (
              <Button
                variant="outline"
                className="border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.12] hover:text-white dark:border-white/15 dark:bg-white/[0.06]"
                onClick={() => setMembersOpen(true)}
              >
                <UserPlus /> Add members
              </Button>
            )}
            <Button variant="gradient" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit segment
            </Button>
            <Button
              variant="ghost"
              className="text-rose-200 hover:bg-rose-500/15 hover:text-white"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 /> Delete
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Rules</CardTitle>
              <Badge variant="secondary">{formatNumber(rules.length)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {segment.type === "DYNAMIC"
                ? `Contacts must match ${segment.matchType === "ALL" ? "every" : "any"} rule below.`
                : "Static segments don't evaluate rules; members are curated by hand."}
            </p>
          </CardHeader>
          <CardContent>
            {segment.type === "DYNAMIC" ? (
              rules.length > 0 ? (
                <ol className="space-y-2">
                  {rules.map((rule, index) => (
                    <li
                      key={`${segment.id}-rule-${index}`}
                      className="rounded-2xl border border-border/60 bg-secondary/20 p-3 dark:bg-white/[0.02]"
                    >
                      <span className="inline-flex items-center rounded-full border border-violet-200/70 bg-violet-100/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/15 dark:text-violet-200">
                        {index === 0 ? "Where" : segment.matchType === "ALL" ? "And" : "Or"}
                      </span>
                      <p className="mt-2 text-sm font-medium leading-relaxed">{describeRule(rule)}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-2xl border border-dashed border-border/70 px-3 py-3 text-xs text-muted-foreground">
                  No rules yet — this segment matches every active contact. Edit the segment to add rules.
                </p>
              )
            ) : (
              <div className="rounded-2xl border border-sky-200/70 bg-sky-50/60 p-3.5 text-xs text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200">
                This is a static segment. Its {formatNumber(totalMembers)} members stay fixed until you add more
                contacts to the list. Existing members are never recalculated from rules.
              </div>
            )}

            <dl className="mt-4 space-y-2 border-t border-border/60 pt-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Last updated</dt>
                <dd className="font-medium">{formatDateTime(segment.updatedAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Segment ID</dt>
                <dd className="truncate font-mono text-[11px]">{segment.id}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
            <div>
              <CardTitle>Members</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {membersQuery.isSuccess
                  ? segment.type === "DYNAMIC"
                    ? `${formatNumber(totalMembers)} ${totalMembers === 1 ? "contact matches" : "contacts match"} this segment.`
                    : `${formatNumber(totalMembers)} ${totalMembers === 1 ? "contact is" : "contacts are"} in this curated list.`
                  : segment.type === "DYNAMIC"
                    ? "Contacts resolved from the current rules."
                    : "Contacts added to this static segment."}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {segment.type === "STATIC" ? (
                <Button variant="soft" size="sm" onClick={() => setMembersOpen(true)}>
                  <UserPlus /> Add members
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void membersQuery.refetch()}
                loading={membersQuery.isFetching}
              >
                <RefreshCw /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {membersQuery.isLoading ? (
              <div className="space-y-2 px-4 pb-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full rounded-2xl" />
                ))}
              </div>
            ) : membersQuery.isError ? (
              <div className="px-4 pb-4">
                <ErrorState
                  title="Members unavailable"
                  message="We couldn't resolve the audience for this segment."
                  onRetry={() => void membersQuery.refetch()}
                />
              </div>
            ) : members.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No members yet"
                description={
                  segment.type === "DYNAMIC"
                    ? "No active contact currently matches these rules. Loosen a rule or add contacts."
                    : "This static segment has no members yet. Add contacts to curate the audience."
                }
                action={
                  segment.type === "STATIC" ? (
                    <Button variant="soft" size="sm" onClick={() => setMembersOpen(true)}>
                      <UserPlus /> Add members
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Contact</TableHead>
                      <TableHead className="min-w-[160px]">Phone</TableHead>
                      <TableHead className="min-w-[120px]">Status</TableHead>
                      <TableHead className="min-w-[120px]">Source</TableHead>
                      <TableHead className="min-w-[130px]">Last engagement</TableHead>
                      <TableHead className="min-w-[120px]">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <Link
                            href={`/contacts/${member.id}`}
                            className="group flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <ContactAvatar contact={member} className="size-9" />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold group-hover:text-violet-700 dark:group-hover:text-violet-300">
                                {displayName(member)}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {member.email ?? "No email"}
                              </span>
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {member.phone ?? "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={member.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {member.source ? titleCase(member.source) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {member.lastEngagementAt ? formatRelative(member.lastEngagementAt) : "Never"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(member.createdAt, "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>

          {membersQuery.isSuccess && members.length > 0 ? (
            <Pagination
              page={memberPage}
              size={MEMBER_SIZE}
              totalItems={totalMembers}
              totalPages={totalPages}
              onPageChange={setMemberPage}
            />
          ) : null}
        </Card>
      </div>

      <SegmentFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        segment={segment}
      />
      {segment.type === "DYNAMIC" ? (
        <SegmentPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          name={segment.name}
          rules={rules}
          matchType={segment.matchType}
        />
      ) : null}
      <SegmentMembersDialog open={membersOpen} onOpenChange={setMembersOpen} segment={segment} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this segment?"
        description={`${segment.name} will be removed. Campaigns that referenced it keep their historical recipients, but new sends cannot target it.`}
        confirmLabel="Delete segment"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
