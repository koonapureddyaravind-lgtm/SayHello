"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, errorMessage } from "@/lib/api";
import { ORGANIZATION_TYPES, type OrganizationType } from "@/components/features/admin/admin-meta";
import { slugify } from "@/components/features/admin/admin-utils";

interface CreatedWorkspace {
  id: string;
  name: string;
  slug: string;
  type?: string;
  status?: string;
  role?: string;
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  organizationId,
  parentName
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  parentName?: string | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [type, setType] = React.useState<OrganizationType>("BUSINESS");
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setSlug("");
    setSlugEdited(false);
    setType("BUSINESS");
    setFormError(null);
  }, [open]);

  const createMutation = useMutation({
    mutationFn: (variables: { name: string; slug: string; type: OrganizationType }) =>
      apiFetch<CreatedWorkspace>(`/organizations/${organizationId}/workspaces`, {
        method: "POST",
        body: variables
      }),
    onSuccess: (workspace, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["workspaces", organizationId] });
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success("Workspace created", {
        description: `${workspace?.name ?? variables.name} is ready to configure.`
      });
      onOpenChange(false);
    },
    onError: (error) => setFormError(errorMessage(error))
  });

  function changeName(value: string) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  function changeSlug(value: string) {
    setSlug(value);
    setSlugEdited(value.trim().length > 0);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const normalizedName = name.trim();
    const normalizedSlug = slugify(slug.trim() || name);
    if (!normalizedName) {
      setFormError("Give the workspace a name so your team can recognise it.");
      return;
    }
    if (!normalizedSlug) {
      setFormError("Add a slug using letters, numbers or dashes.");
      return;
    }

    createMutation.mutate({ name: normalizedName, slug: normalizedSlug, type });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!createMutation.isPending ? onOpenChange(next) : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a workspace</DialogTitle>
          <DialogDescription>
            Add a client, brand or regional workspace under {parentName ?? "this organization"}. You can connect its
            channels once it is created.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(event) => changeName(event.target.value)}
              placeholder="Acme Retail — Europe"
              leftIcon={<Building2 />}
              autoComplete="organization"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="workspace-slug">Slug</Label>
            <Input
              id="workspace-slug"
              value={slug}
              onChange={(event) => changeSlug(event.target.value)}
              placeholder="acme-retail-europe"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Used in links and API references. Generated from the name until you edit it.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="workspace-type">Workspace type</Label>
            <Select value={type} onValueChange={(value) => setType(value as OrganizationType)}>
              <SelectTrigger id="workspace-type">
                <SelectValue placeholder="Choose a type" />
              </SelectTrigger>
              <SelectContent>
                {ORGANIZATION_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {ORGANIZATION_TYPES.find((option) => option.value === type)?.blurb}
            </p>
          </div>

          {formError ? (
            <ErrorState
              title="Couldn't create workspace"
              message={formError}
              onRetry={() => {
                setFormError(null);
              }}
            />
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="gradient" loading={createMutation.isPending}>
              <Building2 /> Create workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
