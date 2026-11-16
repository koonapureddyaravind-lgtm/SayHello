"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Tag as TagIcon,
  Trash2,
  UserPlus,
  Users
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Pagination } from "@/components/common/pagination";
import { StatusBadge } from "@/components/common/status-badge";
import { ChannelBadge } from "@/components/common/channel-badge";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiClientError, apiFetch, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { displayName, formatDate, formatDateTime, formatNumber, formatRelative, titleCase, truncate } from "@/lib/format";
import type { Channel, Contact, PageResponse, Tag } from "@/lib/types";
import { crmKeys } from "@/components/features/crm/crm-keys";
import { ContactAvatar, TagPill } from "@/components/features/crm/contact-visuals";
import { ContactFormDialog } from "@/components/features/crm/contact-form-dialog";
import { RecordConsentDialog } from "@/components/features/crm/record-consent-dialog";

interface BackendActivity {
  id: string;
  type: string;
  channel?: Channel | null;
  payload: Record<string, unknown>;
  occurredAt: string;
}

const ACTIVITY_SIZE = 10;

function attributeValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function payloadSummary(payload: Record<string, unknown>): string | null {
  const tagName = payload.tagName;
  if (typeof tagName === "string" && tagName) return `Tag · ${tagName}`;
  const entries = Object.entries(payload).filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (entries.length === 0) return null;
  const summary = entries
    .map(([key, value]) => {
      const formatted =
        typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
      return `${titleCase(key.replace(/_/g, " "))}: ${formatted}`;
    })
    .join(" · ");
  return truncate(summary, 180);
}

function activityVisual(type: string): { icon: typeof Activity; className: string } {
  if (type.startsWith("TAG_")) {
    return { icon: TagIcon, className: "from-amber-400 to-orange-600" };
  }
  if (type === "CONTACT_CREATED") {
    return { icon: UserPlus, className: "from-emerald-500 to-teal-600" };
  }
  if (type === "CONTACT_UPDATED") {
    return { icon: Pencil, className: "from-violet-500 to-fuchsia-600" };
  }
  return { icon: Activity, className: "from-sky-500 to-blue-600" };
}

function DetailItem({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium">{value}</dd>
    </div>
  );
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const contactId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [tab, setTab] = React.useState("overview");
  const [activityPage, setActivityPage] = React.useState(0);
  const [editOpen, setEditOpen] = React.useState(false);
  const [consentOpen, setConsentOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [tagToAdd, setTagToAdd] = React.useState("");

  React.useEffect(() => {
    setActivityPage(0);
    setTab("overview");
  }, [contactId]);

  const contactQuery = useQuery({
    queryKey: crmKeys.contacts.detail(contactId),
    queryFn: () => apiFetch<Contact>(`/contacts/${contactId}`),
    enabled: Boolean(contactId)
  });

  const tagsQuery = useQuery({
    queryKey: crmKeys.tags,
    queryFn: () => apiFetch<Tag[]>("/tags")
  });

  const activitiesQuery = useQuery({
    queryKey: crmKeys.contacts.activities(contactId, activityPage, ACTIVITY_SIZE),
    queryFn: () =>
      apiFetch<PageResponse<BackendActivity>>(`/contacts/${contactId}/activities`, {
        query: { page: activityPage, size: ACTIVITY_SIZE }
      }),
    enabled: Boolean(contactId) && tab === "activity"
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch<void>(`/contacts/${contactId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Contact deleted");
      void queryClient.invalidateQueries({ queryKey: crmKeys.contacts.all });
      void queryClient.invalidateQueries({ queryKey: crmKeys.tags });
      router.push("/contacts");
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  const addTagMutation = useMutation({
    mutationFn: (tagId: string) => apiFetch<void>(`/contacts/${contactId}/tags/${tagId}`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Tag added");
      setTagToAdd("");
      void queryClient.invalidateQueries({ queryKey: crmKeys.contacts.detail(contactId) });
      void queryClient.invalidateQueries({ queryKey: crmKeys.contacts.all });
      void queryClient.invalidateQueries({ queryKey: crmKeys.tags });
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  const removeTagMutation = useMutation({
    mutationFn: (tagId: string) => apiFetch<void>(`/contacts/${contactId}/tags/${tagId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Tag removed");
      void queryClient.invalidateQueries({ queryKey: crmKeys.contacts.detail(contactId) });
      void queryClient.invalidateQueries({ queryKey: crmKeys.contacts.all });
      void queryClient.invalidateQueries({ queryKey: crmKeys.tags });
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  if (contactQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-48 w-full rounded-[30px]" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 w-full rounded-3xl lg:col-span-2" />
          <Skeleton className="h-80 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (contactQuery.isError || !contactQuery.data) {
    const notFound = contactQuery.error instanceof ApiClientError && contactQuery.error.status === 404;
    return (
      <div className="space-y-6">
        <Link
          href="/contacts"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All contacts
        </Link>
        <ErrorState
          title={notFound ? "Contact not found" : "Contact unavailable"}
          message={
            notFound
              ? "This contact may have been deleted or belongs to another workspace."
              : "We couldn't load this contact profile. Try again in a moment."
          }
          onRetry={notFound ? undefined : () => void contactQuery.refetch()}
        />
      </div>
    );
  }

  const contact = contactQuery.data;
  const allTags = tagsQuery.data ?? [];
  const appliedTagIds = new Set((contact.tags ?? []).map((tag) => tag.id));
  const availableTags = allTags.filter((tag) => !appliedTagIds.has(tag.id));
  const attributes = Object.entries(contact.attributes ?? {});
  const activities = activitiesQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All contacts
      </Link>

      <section className="relative overflow-hidden rounded-[30px] bg-[#0b0618] p-6 text-white shadow-float sm:p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 -top-20 size-72 rounded-full bg-violet-600/40 blur-[100px]" />
          <div className="absolute right-1/4 top-1/2 size-64 rounded-full bg-fuchsia-600/25 blur-[100px]" />
          <div className="absolute -bottom-24 right-0 size-72 rounded-full bg-amber-500/15 blur-[100px]" />
          <div className="absolute inset-0 bg-grid-fade bg-[length:40px_40px] opacity-30" />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4 sm:items-center">
            <ContactAvatar
              contact={contact}
              className="size-16 shrink-0 ring-2 ring-white/20 sm:size-20"
              fallbackClassName="text-lg sm:text-xl"
            />
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-white/70 backdrop-blur">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Contact profile
              </span>
              <h1 className="mt-3 truncate font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                {displayName(contact)}
              </h1>
              <p className="mt-1 truncate text-sm text-white/55">
                {contact.email ?? contact.phone ?? "No contact details on file"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium text-white/60">
                <StatusBadge status={contact.status} />
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5">
                  Source · {contact.source ? titleCase(contact.source) : "Unknown"}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5">
                  Added {formatDate(contact.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.12] hover:text-white dark:border-white/15 dark:bg-white/[0.06]"
              onClick={() => setEditOpen(true)}
            >
              <Pencil /> Edit
            </Button>
            <Button variant="gradient" onClick={() => setConsentOpen(true)}>
              <BadgeCheck /> Record consent
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Users /> Overview
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity /> Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Profile details</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Identity, lifecycle and engagement data stored on this contact.
                </p>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  <DetailItem
                    label="Email"
                    icon={<Mail className="size-3" />}
                    value={contact.email ?? "—"}
                  />
                  <DetailItem
                    label="Phone"
                    icon={<Phone className="size-3" />}
                    value={contact.phone ?? "—"}
                  />
                  <DetailItem label="Status" value={<StatusBadge status={contact.status} />} />
                  <DetailItem label="Source" value={contact.source ? titleCase(contact.source) : "—"} />
                  <DetailItem label="External ID" value={contact.externalId ?? "—"} />
                  <DetailItem
                    label="Created"
                    icon={<CalendarDays className="size-3" />}
                    value={formatDateTime(contact.createdAt)}
                  />
                  <DetailItem label="Last updated" value={formatDateTime(contact.updatedAt)} />
                  <DetailItem
                    label="Last engagement"
                    value={contact.lastEngagementAt ? formatRelative(contact.lastEngagementAt) : "Never"}
                  />
                </dl>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>Tags</CardTitle>
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {formatNumber(contact.tags?.length ?? 0)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">Used by filters, segments and automations.</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {contact.tags && contact.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {contact.tags.map((tag) => (
                        <TagPill
                          key={tag.id}
                          tag={tag}
                          onRemove={
                            removeTagMutation.isPending ? undefined : () => removeTagMutation.mutate(tag.id)
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-border/70 px-3 py-2.5 text-xs text-muted-foreground">
                      No tags on this contact yet.
                    </p>
                  )}

                  {tagsQuery.isLoading ? (
                    <Skeleton className="h-11 w-full" />
                  ) : availableTags.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <Select value={tagToAdd} onValueChange={setTagToAdd}>
                        <SelectTrigger className="h-9 flex-1 text-xs" aria-label="Choose a tag to add">
                          <SelectValue placeholder="Add a tag…" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTags.map((tag) => (
                            <SelectItem key={tag.id} value={tag.id}>
                              {tag.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="soft"
                        size="icon-sm"
                        disabled={!tagToAdd}
                        loading={addTagMutation.isPending}
                        onClick={() => {
                          if (tagToAdd) addTagMutation.mutate(tagToAdd);
                        }}
                        aria-label="Add tag"
                      >
                        <Plus />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      {allTags.length === 0
                        ? "Create a tag from the contacts directory to organise this person."
                        : "Every available tag is already applied."}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Custom attributes</CardTitle>
                  <p className="text-sm text-muted-foreground">Extra context from imports and forms.</p>
                </CardHeader>
                <CardContent>
                  {attributes.length > 0 ? (
                    <dl className="space-y-2.5">
                      {attributes.map(([key, value]) => (
                        <div key={key} className="flex items-start justify-between gap-3 text-sm">
                          <dt className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {key}
                          </dt>
                          <dd className="max-w-[60%] truncate text-right text-sm font-medium">
                            {attributeValue(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="rounded-xl border border-dashed border-border/70 px-3 py-2.5 text-xs text-muted-foreground">
                      No custom attributes. Edit the contact to add company, plan or lifecycle context.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
              <div>
                <CardTitle>Activity timeline</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Creation, updates and tag changes recorded for this contact.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void activitiesQuery.refetch()}
                loading={activitiesQuery.isFetching}
              >
                <RefreshCw /> Refresh
              </Button>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {activitiesQuery.isLoading ? (
                <div className="space-y-2 px-4 pb-4">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 w-full rounded-2xl" />
                  ))}
                </div>
              ) : activitiesQuery.isError ? (
                <div className="px-4 pb-4">
                  <ErrorState
                    title="Activity unavailable"
                    message="We couldn't load this contact's activity timeline."
                    onRetry={() => void activitiesQuery.refetch()}
                  />
                </div>
              ) : activities.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No activity yet"
                  description="Creation, edits and tag changes will appear here as the contact moves through your workspace."
                />
              ) : (
                <div className="space-y-2 px-4 pb-2">
                  {activities.map((activity) => {
                    const visual = activityVisual(activity.type);
                    const Icon = visual.icon;
                    const summary = payloadSummary(activity.payload);
                    return (
                      <div
                        key={activity.id}
                        className="flex gap-3 rounded-2xl border border-border/60 bg-card/60 p-3.5 dark:bg-white/[0.02]"
                      >
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
                            visual.className
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">
                              {titleCase(activity.type.replace(/_/g, " "))}
                            </p>
                            {activity.channel ? (
                              <ChannelBadge channel={activity.channel} className="px-1.5 py-0 text-[10px]" />
                            ) : null}
                            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                              {formatDateTime(activity.occurredAt)}
                            </span>
                          </div>
                          {summary ? (
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{summary}</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>

            {activitiesQuery.isSuccess && activities.length > 0 ? (
              <Pagination
                page={activityPage}
                size={ACTIVITY_SIZE}
                totalItems={activitiesQuery.data?.totalItems ?? 0}
                totalPages={activitiesQuery.data?.totalPages ?? 0}
                onPageChange={setActivityPage}
              />
            ) : null}
          </Card>
        </TabsContent>
      </Tabs>

      <ContactFormDialog open={editOpen} onOpenChange={setEditOpen} contact={contact} />
      <RecordConsentDialog open={consentOpen} onOpenChange={setConsentOpen} contact={contact} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this contact?"
        description={`${displayName(contact)} will be removed from the directory and stop receiving campaign sends. This cannot be undone.`}
        confirmLabel="Delete contact"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
