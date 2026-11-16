"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, RefreshCw, Trash2, UserPlus, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Pagination } from "@/components/common/pagination";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { RoleBadge, MemberStatusBadge } from "@/components/features/admin/admin-badges";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatDate, formatNumber, initials } from "@/lib/format";
import type { Membership, PageResponse } from "@/lib/types";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { CHANGE_ROLES, ROLE_EXPLAINERS, roleMeta } from "@/components/features/admin/admin-meta";
import { normalizePage } from "@/components/features/admin/admin-utils";
import { InviteMemberDialog } from "@/components/features/admin/invite-member-dialog";

type MemberList = Membership[] | PageResponse<Membership>;

function RoleExplainerCard({ role }: { role: string }) {
  const meta = roleMeta(role);
  const Icon = meta.icon;

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-border/70 bg-card/80 p-5 shadow-card backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-float dark:border-white/[0.08] dark:bg-white/[0.035]">
      <div className={cn("pointer-events-none absolute -right-8 -top-10 size-28 rounded-full blur-3xl", meta.orb)} />
      <div className="relative flex items-start gap-2.5">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
            meta.gradient
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold">{meta.label}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{meta.blurb}</p>
        </div>
      </div>
      <ul className="relative mt-3 space-y-1.5">
        {meta.permissions.map((permission) => (
          <li key={permission} className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Check className="mt-0.5 size-3 shrink-0 text-emerald-500" />
            {permission}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TeamView() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useWorkspace();
  const organizationId = currentOrganization?.id;

  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [removeTarget, setRemoveTarget] = React.useState<Membership | null>(null);

  const membersQuery = useQuery({
    queryKey: ["members", organizationId, page, size],
    queryFn: () =>
      apiFetch<MemberList>(`/organizations/${organizationId}/members`, {
        query: { page, size }
      }),
    enabled: Boolean(organizationId)
  });

  const memberPage = React.useMemo(
    () => normalizePage<Membership>(membersQuery.data, size),
    [membersQuery.data, size]
  );

  const roleMutation = useMutation({
    mutationFn: (variables: { membershipId: string; role: string }) =>
      apiFetch<Membership>(`/organizations/${organizationId}/members/${variables.membershipId}`, {
        method: "PATCH",
        body: { role: variables.role }
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members", organizationId] });
      toast.success("Role updated");
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  const removeMutation = useMutation({
    mutationFn: (membershipId: string) =>
      apiFetch<void>(`/organizations/${organizationId}/members/${membershipId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members", organizationId] });
      toast.success("Member removed", { description: "They no longer have access to this workspace." });
      setRemoveTarget(null);
    },
    onError: (error) => toast.error(errorMessage(error))
  });

  if (!organizationId) {
    return (
      <ErrorState
        title="No workspace selected"
        message="Choose a workspace from the sidebar to manage its team."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Team"
        description="Invite teammates, shape roles and keep access in step with how your team works."
        actions={
          <>
            <Button variant="outline" onClick={() => void membersQuery.refetch()} loading={membersQuery.isFetching}>
              <RefreshCw /> Refresh
            </Button>
            <Button variant="gradient" onClick={() => setInviteOpen(true)}>
              <UserPlus /> Invite member
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 py-4 dark:border-white/[0.06]">
          <div>
            <CardTitle className="text-base">Members</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatNumber(memberPage.totalItems)} {memberPage.totalItems === 1 ? "person has" : "people have"} access to{" "}
              {currentOrganization?.name ?? "this workspace"}.
            </p>
          </div>
          <span className="rounded-full bg-brand-gradient-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-200">
            {currentOrganization?.role ? roleMeta(currentOrganization.role).label : "Workspace"}
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {membersQuery.isLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : membersQuery.isError ? (
            <div className="p-6">
              <ErrorState
                title="Team members are unavailable"
                message={errorMessage(membersQuery.error)}
                onRetry={() => void membersQuery.refetch()}
              />
            </div>
          ) : memberPage.items.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="No teammates yet"
              description="Invite the people who plan campaigns, answer conversations and keep the workspace running."
              action={
                <Button variant="gradient" onClick={() => setInviteOpen(true)}>
                  <UserPlus /> Invite member
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberPage.items.map((member) => {
                  const label = member.fullName?.trim() || member.email;
                  const roleChanging =
                    roleMutation.isPending && roleMutation.variables?.membershipId === member.membershipId;

                  return (
                    <TableRow key={member.membershipId} className="table-row-hover">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-10">
                            <AvatarFallback className="text-[10px]">{initials(label)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{label}</p>
                            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={member.role} />
                      </TableCell>
                      <TableCell>
                        <MemberStatusBadge status={member.status} />
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell">
                        {formatDate(member.joinedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          <Select
                            value={member.role}
                            onValueChange={(nextRole) =>
                              roleMutation.mutate({ membershipId: member.membershipId, role: nextRole })
                            }
                            disabled={roleChanging}
                          >
                            <SelectTrigger
                              className="h-8 w-[168px] rounded-lg text-xs"
                              aria-label={`Change role for ${label}`}
                            >
                              <SelectValue>{roleMeta(member.role).label}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {CHANGE_ROLES.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {roleMeta(role).label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
                            onClick={() => setRemoveTarget(member)}
                            aria-label={`Remove ${label}`}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {memberPage.paginated && memberPage.totalItems > 0 ? (
          <Pagination
            page={memberPage.page}
            totalPages={memberPage.totalPages}
            totalItems={memberPage.totalItems}
            size={memberPage.size}
            onPageChange={setPage}
            onSizeChange={(nextSize) => {
              setSize(nextSize);
              setPage(0);
            }}
          />
        ) : null}
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">What each role can do</h2>
          <p className="text-sm text-muted-foreground">
            Roles are additive by design — every teammate sees only the surface they need.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ROLE_EXPLAINERS.map((role) => (
            <RoleExplainerCard key={role} role={role} />
          ))}
        </div>
      </section>

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        organizationId={organizationId}
        organizationName={currentOrganization?.name}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open && !removeMutation.isPending) setRemoveTarget(null);
        }}
        title="Remove member?"
        description="They will lose access to this workspace immediately. Campaigns and conversations they worked on stay intact."
        confirmLabel="Remove member"
        destructive
        loading={removeMutation.isPending}
        onConfirm={() => {
          if (removeTarget) removeMutation.mutate(removeTarget.membershipId);
        }}
      >
        {removeTarget ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-secondary/30 p-3 dark:border-white/[0.07] dark:bg-white/[0.03]">
            <Avatar className="size-9">
              <AvatarFallback className="text-[10px]">
                {initials(removeTarget.fullName?.trim() || removeTarget.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{removeTarget.fullName?.trim() || removeTarget.email}</p>
              <p className="truncate text-xs text-muted-foreground">{removeTarget.email}</p>
            </div>
            <RoleBadge role={removeTarget.role} className="ml-auto" />
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
