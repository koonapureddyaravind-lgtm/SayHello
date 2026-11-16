"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  Download,
  Filter,
  MailX,
  MinusCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
  Upload,
  UserCheck,
  Users
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Pagination } from "@/components/common/pagination";
import { StatusBadge } from "@/components/common/status-badge";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { apiFetch, errorMessage } from "@/lib/api";
import { displayName, formatDate, formatNumber, formatRelative, titleCase } from "@/lib/format";
import type { Contact, ContactStatus, PageResponse, Tag } from "@/lib/types";
import { crmKeys } from "@/components/features/crm/crm-keys";
import { ContactAvatar, TagPill } from "@/components/features/crm/contact-visuals";
import { ContactFormDialog } from "@/components/features/crm/contact-form-dialog";
import { ManageTagsDialog } from "@/components/features/crm/manage-tags-dialog";
import { RecordConsentDialog } from "@/components/features/crm/record-consent-dialog";
import { useDebouncedValue } from "@/components/features/crm/use-debounced-value";

const STATUS_FILTERS: { value: ContactStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "UNSUBSCRIBED", label: "Unsubscribed" },
  { value: "BOUNCED", label: "Bounced" },
  { value: "DELETED", label: "Deleted" }
];

const SUMMARY_FILTERS: { status?: ContactStatus; key: string }[] = [
  { key: "all" },
  { status: "ACTIVE", key: "active" },
  { status: "UNSUBSCRIBED", key: "unsubscribed" },
  { status: "BOUNCED", key: "bounced" }
];

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(20);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<ContactStatus | "ALL">("ALL");
  const [tagFilter, setTagFilter] = React.useState("ALL");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingContact, setEditingContact] = React.useState<Contact | null>(null);
  const [tagsOpen, setTagsOpen] = React.useState(false);
  const [consentContact, setConsentContact] = React.useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Contact | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q");
    if (initialQuery) setSearch(initialQuery);
    if (params.get("create") === "1") setFormOpen(true);
  }, []);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter, tagFilter]);

  const params = React.useMemo(
    () => ({
      page,
      size,
      q: debouncedSearch || undefined,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      tagId: tagFilter === "ALL" ? undefined : tagFilter
    }),
    [page, size, debouncedSearch, statusFilter, tagFilter]
  );

  const contactsQuery = useQuery({
    queryKey: crmKeys.contacts.list(params),
    queryFn: () => apiFetch<PageResponse<Contact>>("/contacts", { query: params })
  });

  const tagsQuery = useQuery({
    queryKey: crmKeys.tags,
    queryFn: () => apiFetch<Tag[]>("/tags")
  });

  const summaryQueries = useQueries({
    queries: SUMMARY_FILTERS.map((filter) => ({
      queryKey: crmKeys.contacts.list({ summary: filter.key }),
      queryFn: () =>
        apiFetch<PageResponse<Contact>>("/contacts", {
          query: { page: 0, size: 1, status: filter.status }
        })
    }))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/contacts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Contact deleted");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: crmKeys.contacts.all });
      void queryClient.invalidateQueries({ queryKey: crmKeys.tags });
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  const contacts = contactsQuery.data?.items ?? [];
  const totalItems = contactsQuery.data?.totalItems ?? 0;
  const totalPages = contactsQuery.data?.totalPages ?? 0;
  const tags = tagsQuery.data ?? [];
  const filtersActive = Boolean(debouncedSearch) || statusFilter !== "ALL" || tagFilter !== "ALL";

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setTagFilter("ALL");
  }

  function openEdit(contact: Contact) {
    setEditingContact(contact);
    setFormOpen(true);
  }

  function openCreate() {
    setEditingContact(null);
    setFormOpen(true);
  }

  const summaryCards = [
    {
      label: "All contacts",
      value: summaryQueries[0]?.data?.totalItems ?? 0,
      icon: Users,
      tone: "violet" as const,
      hint: "Every record in the directory"
    },
    {
      label: "Active",
      value: summaryQueries[1]?.data?.totalItems ?? 0,
      icon: UserCheck,
      tone: "emerald" as const,
      hint: "Reachable on at least one channel"
    },
    {
      label: "Unsubscribed",
      value: summaryQueries[2]?.data?.totalItems ?? 0,
      icon: MinusCircle,
      tone: "amber" as const,
      hint: "Opted out of marketing"
    },
    {
      label: "Bounced",
      value: summaryQueries[3]?.data?.totalItems ?? 0,
      icon: MailX,
      tone: "rose" as const,
      hint: "Addresses that rejected delivery"
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM"
        title="Contacts"
        description="Every person you can reach, with the tags, attributes and engagement history your team needs."
        actions={
          <>
            <Button asChild variant="outline">
              <a href="/api/backend/contacts/export" download>
                <Download /> Export
              </a>
            </Button>
            <Button variant="outline" onClick={() => setTagsOpen(true)}>
              <Tags /> Manage tags
            </Button>
            <Button asChild variant="outline">
              <Link href="/contacts/import">
                <Upload /> Import
              </Link>
            </Button>
            <Button variant="gradient" onClick={openCreate}>
              <Plus /> Add contact
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card, index) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            tone={card.tone}
            hint={card.hint}
            loading={summaryQueries[index]?.isLoading ?? false}
          />
        ))}
      </div>

      <Card>
        <CardHeader className="gap-4 pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Directory</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {contactsQuery.isSuccess
                  ? `${formatNumber(totalItems)} ${totalItems === 1 ? "contact" : "contacts"}${filtersActive ? " match these filters" : ""}`
                  : "Search, filter and manage every contact."}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email or phone…"
                leftIcon={<Search />}
                className="sm:w-64"
                aria-label="Search contacts"
              />
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as ContactStatus | "ALL")}
              >
                <SelectTrigger className="sm:w-[160px]" aria-label="Filter by status">
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
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="sm:w-[170px]" aria-label="Filter by tag">
                  <SelectValue placeholder="All tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All tags</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filtersActive ? (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <Filter /> Clear
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {contactsQuery.isLoading ? (
            <div className="space-y-2 px-4 pb-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-2xl" />
              ))}
            </div>
          ) : contactsQuery.isError ? (
            <div className="px-4 pb-4">
              <ErrorState
                title="Contacts unavailable"
                message="We couldn't load the contact directory. Check your connection and try again."
                onRetry={() => void contactsQuery.refetch()}
              />
            </div>
          ) : contacts.length === 0 ? (
            filtersActive ? (
              <EmptyState
                icon={Search}
                title="No contacts match these filters"
                description="Try a broader search, a different status, or clear the tag filter."
                action={
                  <Button variant="soft" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Users}
                title="Your directory is empty"
                description="Add your first contact manually or import a CSV export from another tool."
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button variant="gradient" size="sm" onClick={openCreate}>
                      <Plus /> Add contact
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/contacts/import">
                        <Upload /> Import contacts
                      </Link>
                    </Button>
                  </div>
                }
              />
            )
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[240px]">Contact</TableHead>
                    <TableHead className="min-w-[150px]">Phone</TableHead>
                    <TableHead className="min-w-[130px]">Status</TableHead>
                    <TableHead className="min-w-[190px]">Tags</TableHead>
                    <TableHead className="min-w-[120px]">Source</TableHead>
                    <TableHead className="min-w-[130px]">Last engagement</TableHead>
                    <TableHead className="min-w-[120px]">Created</TableHead>
                    <TableHead className="w-[60px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="group flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <ContactAvatar contact={contact} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold group-hover:text-violet-700 dark:group-hover:text-violet-300">
                              {displayName(contact)}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {contact.email ?? "No email"}
                            </span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.phone ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={contact.status} />
                      </TableCell>
                      <TableCell>
                        {contact.tags && contact.tags.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {contact.tags.slice(0, 2).map((tag) => (
                              <TagPill key={tag.id} tag={tag} />
                            ))}
                            {contact.tags.length > 2 ? (
                              <span className="text-[11px] font-semibold text-muted-foreground">
                                +{contact.tags.length - 2}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {contact.source ? titleCase(contact.source) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {contact.lastEngagementAt ? formatRelative(contact.lastEngagementAt) : "Never"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(contact.createdAt, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${displayName(contact)}`}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openEdit(contact)}>
                              <Pencil /> Edit contact
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setConsentContact(contact)}>
                              <BadgeCheck /> Record consent
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem destructive onSelect={() => setDeleteTarget(contact)}>
                              <Trash2 /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        {contactsQuery.isSuccess && contacts.length > 0 ? (
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
          />
        ) : null}
      </Card>

      <ContactFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingContact(null);
        }}
        contact={editingContact}
      />
      <ManageTagsDialog open={tagsOpen} onOpenChange={setTagsOpen} />
      <RecordConsentDialog
        open={consentContact !== null}
        onOpenChange={(open) => {
          if (!open) setConsentContact(null);
        }}
        contact={consentContact}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this contact?"
        description={
          deleteTarget
            ? `${displayName(deleteTarget)} will be removed from the directory and stop receiving campaign sends. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete contact"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      >
        {deleteTarget ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/60 px-3.5 py-2.5 text-xs text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>Consent history is retained for audit purposes, but the profile is hidden from lists and segments.</span>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
