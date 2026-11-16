"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, Mail, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { apiFetch, errorMessage } from "@/lib/api";
import type { Membership } from "@/lib/types";
import { INVITE_ROLES, roleMeta } from "@/components/features/admin/admin-meta";

export function InviteMemberDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName?: string | null;
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<string>("ADMIN");
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setEmail("");
    setRole("ADMIN");
    setFormError(null);
  }, [open]);

  const inviteMutation = useMutation({
    mutationFn: (variables: { email: string; role: string }) =>
      apiFetch<Membership>(`/organizations/${organizationId}/members`, {
        method: "POST",
        body: variables
      }),
    onSuccess: (member, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["members", organizationId] });
      toast.success("Invitation sent", {
        description: `${member?.email ?? variables.email} was added as ${roleMeta(variables.role).label}.`
      });
      onOpenChange(false);
    },
    onError: (error) => setFormError(errorMessage(error))
  });

  const selectedRole = roleMeta(role);
  const RoleIcon = selectedRole.icon;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setFormError("Enter a valid email address for your teammate.");
      return;
    }

    inviteMutation.mutate({ email: normalizedEmail, role });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!inviteMutation.isPending ? onOpenChange(next) : undefined)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>
            Add someone to {organizationName ?? "this workspace"} and choose the access they need on day one.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Work email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@company.com"
              leftIcon={<Mail />}
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="invite-role">
                <SelectValue placeholder="Choose a role" />
              </SelectTrigger>
              <SelectContent>
                {INVITE_ROLES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {roleMeta(value).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-2xl border border-border/70 bg-secondary/30 p-3.5 dark:border-white/[0.07] dark:bg-white/[0.03]">
            <div className="flex items-start gap-2.5">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
                  selectedRole.gradient
                )}
              >
                <RoleIcon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{selectedRole.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{selectedRole.blurb}</p>
                {selectedRole.permissions.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {selectedRole.permissions.map((permission) => (
                      <li key={permission} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="size-1 rounded-full bg-violet-400" />
                        {permission}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>

          {formError ? (
            <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200/70 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={inviteMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" loading={inviteMutation.isPending}>
              <Send /> Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
