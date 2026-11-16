"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  Bell,
  Building2,
  Globe2,
  Info,
  Link2,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { CopyButton } from "@/components/common/copy-button";
import { RoleBadge } from "@/components/features/admin/admin-badges";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { cn } from "@/lib/cn";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Organization } from "@/lib/types";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { ORGANIZATION_TYPES, TIMEZONES, type OrganizationType } from "@/components/features/admin/admin-meta";
import { normalizeList } from "@/components/features/admin/admin-utils";
import { CreateWorkspaceDialog } from "@/components/features/admin/create-workspace-dialog";
import packageJson from "@/package.json";

const TAB_VALUES = ["workspace", "preferences", "about"] as const;
type TabValue = (typeof TAB_VALUES)[number];

const PREFERENCES_KEY = "omniflow:admin-preferences";

interface AdminPreferences {
  productUpdates: boolean;
  weeklyDigest: boolean;
  desktopAlerts: boolean;
}

const DEFAULT_PREFERENCES: AdminPreferences = {
  productUpdates: true,
  weeklyDigest: false,
  desktopAlerts: false
};

interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  type?: string;
  status?: string;
  role?: string;
}

const HEALTH_PATHS = [
  {
    path: "/actuator/health",
    label: "Health",
    description: "Liveness and readiness state for the API and its dependencies."
  },
  {
    path: "/actuator/info",
    label: "Build info",
    description: "Build and version metadata exposed by Spring Boot."
  },
  {
    path: "/actuator/prometheus",
    label: "Metrics",
    description: "Plain-text Prometheus scrape endpoint for monitoring."
  }
];

const SECURITY_NOTES = [
  "Access and refresh tokens stay in HTTP-only cookies and are attached by the server-side proxy, never by browser JavaScript.",
  "Every API request is scoped to the active workspace through the proxy's organization header.",
  "Provider credentials are write-only: the API returns configuration flags, never the stored secrets.",
  "Audit history records the actor, action and before/after snapshots for administrative changes."
];

function asOrganizationType(value: string | undefined): OrganizationType {
  const match = ORGANIZATION_TYPES.find((option) => option.value === value);
  return match ? match.value : "BUSINESS";
}

function typeLabel(value: string | undefined): string {
  return ORGANIZATION_TYPES.find((option) => option.value === value)?.label ?? value ?? "Business";
}

function initialTab(): TabValue {
  if (typeof window === "undefined") return "workspace";
  const requested = new URLSearchParams(window.location.search).get("tab");
  if (requested === "profile" || requested === "preferences") return "preferences";
  if (requested === "about") return "about";
  return "workspace";
}

function readPreferences(): AdminPreferences {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<AdminPreferences>;
    return {
      productUpdates: typeof parsed.productUpdates === "boolean" ? parsed.productUpdates : DEFAULT_PREFERENCES.productUpdates,
      weeklyDigest: typeof parsed.weeklyDigest === "boolean" ? parsed.weeklyDigest : DEFAULT_PREFERENCES.weeklyDigest,
      desktopAlerts: typeof parsed.desktopAlerts === "boolean" ? parsed.desktopAlerts : DEFAULT_PREFERENCES.desktopAlerts
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function persistPreferences(preferences: AdminPreferences): void {
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Storage may be disabled; preferences simply fall back to this session.
  }
}

function PreferenceRow({
  id,
  title,
  description,
  checked,
  onCheckedChange
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer">
          {title}
        </Label>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function SettingsView() {
  const queryClient = useQueryClient();
  const { currentOrganization, organizations, refresh } = useWorkspace();
  const organizationId = currentOrganization?.id;

  const [tab, setTab] = React.useState<TabValue>("workspace");
  const [form, setForm] = React.useState<{
    name: string;
    slug: string;
    type: OrganizationType;
    timezone: string;
  }>({ name: "", slug: "", type: "BUSINESS", timezone: "UTC" });
  const [formError, setFormError] = React.useState<string | null>(null);
  const [preferences, setPreferences] = React.useState<AdminPreferences>(DEFAULT_PREFERENCES);
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    setPreferences(readPreferences());
    setTab(initialTab());
  }, []);

  const organizationQuery = useQuery({
    queryKey: ["organization", organizationId],
    queryFn: () => apiFetch<Organization>(`/organizations/${organizationId}`),
    enabled: Boolean(organizationId),
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  const workspacesQuery = useQuery({
    queryKey: ["workspaces", organizationId],
    queryFn: () => apiFetch<unknown>(`/organizations/${organizationId}/workspaces`),
    enabled: Boolean(organizationId)
  });

  const organization = organizationQuery.data;

  React.useEffect(() => {
    if (!organization) return;
    setForm({
      name: organization.name ?? "",
      slug: organization.slug ?? "",
      type: asOrganizationType(organization.type),
      timezone: organization.timezone ?? "UTC"
    });
    setFormError(null);
  }, [organization]);

  const workspaces = React.useMemo(
    () => normalizeList<WorkspaceSummary>(workspacesQuery.data),
    [workspacesQuery.data]
  );

  const parent = React.useMemo(
    () => organizations.find((item) => item.id === organization?.parentOrganizationId) ?? null,
    [organizations, organization?.parentOrganizationId]
  );

  const timezoneOptions = React.useMemo(() => {
    if (!form.timezone || TIMEZONES.some((option) => option.value === form.timezone)) return TIMEZONES;
    return [{ value: form.timezone, label: form.timezone }, ...TIMEZONES];
  }, [form.timezone]);

  const updateMutation = useMutation({
    mutationFn: (variables: { name: string; slug: string; type: OrganizationType; timezone: string }) =>
      apiFetch<Organization>(`/organizations/${organizationId}`, {
        method: "PATCH",
        body: variables
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["organization", organizationId], updated);
      void queryClient.invalidateQueries({ queryKey: ["organization", organizationId] });
      void refresh();
      toast.success("Workspace updated", { description: "Your changes are live for everyone in this workspace." });
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessage(error))
  });

  const refreshing = organizationQuery.isFetching || workspacesQuery.isFetching;

  function changeTab(value: string) {
    const next: TabValue = TAB_VALUES.includes(value as TabValue) ? (value as TabValue) : "workspace";
    setTab(next);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (next === "workspace") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.toString());
  }

  function setPreference<K extends keyof AdminPreferences>(key: K, value: AdminPreferences[K]) {
    setPreferences((previous) => {
      const next = { ...previous, [key]: value };
      persistPreferences(next);
      return next;
    });
  }

  function resetPreferences() {
    setPreferences(DEFAULT_PREFERENCES);
    persistPreferences(DEFAULT_PREFERENCES);
    toast.success("Preferences reset", { description: "Notification preferences are back to their defaults." });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const name = form.name.trim();
    const slug = form.slug.trim();
    if (!name) {
      setFormError("Workspace name cannot be empty.");
      return;
    }
    if (!slug) {
      setFormError("Add a slug using letters, numbers or dashes.");
      return;
    }

    updateMutation.mutate({ name, slug, type: form.type, timezone: form.timezone });
  }

  if (!organizationId) {
    return (
      <ErrorState
        title="No workspace selected"
        message="Choose a workspace from the sidebar to manage its settings."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace administration"
        title="Settings"
        description="Shape how this workspace looks, behaves and connects to the rest of your organization."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void organizationQuery.refetch();
              void workspacesQuery.refetch();
            }}
            loading={refreshing}
          >
            <RefreshCw /> Refresh
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="workspace">
            <Building2 /> Workspace
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <Palette /> Preferences
          </TabsTrigger>
          <TabsTrigger value="about">
            <Info /> About
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-5">
          {organizationQuery.isLoading ? (
            <div className="grid gap-5 lg:grid-cols-3">
              <Skeleton className="h-[420px] lg:col-span-2" />
              <Skeleton className="h-[240px]" />
            </div>
          ) : organizationQuery.isError ? (
            <ErrorState
              title="Workspace settings unavailable"
              message={errorMessage(organizationQuery.error)}
              onRetry={() => void organizationQuery.refetch()}
            />
          ) : (
            <>
              <div className="grid gap-5 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Workspace profile</CardTitle>
                    <CardDescription>
                      These details identify the workspace in navigation, shared links and audit history.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={submit} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor="settings-name">Workspace name</Label>
                          <Input
                            id="settings-name"
                            value={form.name}
                            onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                            placeholder="Acme Retail"
                            autoComplete="organization"
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="settings-slug">Slug</Label>
                          <Input
                            id="settings-slug"
                            value={form.slug}
                            onChange={(event) => setForm((previous) => ({ ...previous, slug: event.target.value }))}
                            placeholder="acme-retail"
                            leftIcon={<Link2 />}
                            autoComplete="off"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="settings-type">Workspace type</Label>
                          <Select
                            value={form.type}
                            onValueChange={(value) =>
                              setForm((previous) => ({ ...previous, type: asOrganizationType(value) }))
                            }
                          >
                            <SelectTrigger id="settings-type">
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
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor="settings-timezone">Timezone</Label>
                          <Select
                            value={form.timezone}
                            onValueChange={(value) => setForm((previous) => ({ ...previous, timezone: value }))}
                          >
                            <SelectTrigger id="settings-timezone">
                              <SelectValue placeholder="Choose a timezone" />
                            </SelectTrigger>
                            <SelectContent>
                              {timezoneOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">
                            Campaign schedules, reports and timestamps follow this timezone.
                          </p>
                        </div>
                      </div>

                      {formError ? (
                        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200/70 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                          <span>{formError}</span>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 dark:border-white/[0.06]">
                        <p className="text-[11px] text-muted-foreground">
                          Workspace ID <span className="font-mono text-foreground/80">{organizationId}</span>
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (!organization) return;
                              setForm({
                                name: organization.name ?? "",
                                slug: organization.slug ?? "",
                                type: asOrganizationType(organization.type),
                                timezone: organization.timezone ?? "UTC"
                              });
                              setFormError(null);
                            }}
                            disabled={updateMutation.isPending}
                          >
                            <RotateCcw /> Reset
                          </Button>
                          <Button type="submit" variant="gradient" loading={updateMutation.isPending}>
                            <Save /> Save changes
                          </Button>
                        </div>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Parent organization</CardTitle>
                    <CardDescription>Where this workspace sits in your account hierarchy.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {parent ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg">
                            <Building2 className="size-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{parent.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{parent.slug}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{typeLabel(parent.type)}</Badge>
                          {parent.status ? <StatusBadge status={parent.status} dot={false} /> : null}
                          {parent.role ? <RoleBadge role={parent.role} /> : null}
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Billing, ownership and agency-level controls are managed by the parent organization.
                        </p>
                      </div>
                    ) : organization?.parentOrganizationId ? (
                      <div className="space-y-3">
                        <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg">
                          <Building2 className="size-5" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold">Managed workspace</p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            This workspace belongs to a parent organization that is not in your current membership list.
                          </p>
                        </div>
                        <p className="break-all rounded-xl bg-secondary/40 px-3 py-2 font-mono text-[10px] dark:bg-white/[0.04]">
                          {organization.parentOrganizationId}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-gradient-soft text-violet-600 dark:text-violet-300">
                          <Sparkles className="size-5" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold">Top-level workspace</p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            This workspace is not managed by a parent organization. You can create client workspaces
                            beneath it at any time.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="mt-4 space-y-2 rounded-2xl border border-border/70 bg-secondary/30 p-3.5 text-xs dark:border-white/[0.06] dark:bg-white/[0.03]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Created</span>
                        <span className="font-medium">{formatDate(organization?.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-medium">{typeLabel(organization?.type)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-col gap-3 border-b border-border/60 py-4 dark:border-white/[0.06] sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base">Workspaces</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Brands, regions or client workspaces that sit under {currentOrganization?.name ?? "this workspace"}.
                    </p>
                  </div>
                  <Button variant="gradient" size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus /> New workspace
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {workspacesQuery.isLoading ? (
                    <div className="space-y-3 p-5">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : workspacesQuery.isError ? (
                    <div className="p-5">
                      <ErrorState
                        title="Workspaces unavailable"
                        message={errorMessage(workspacesQuery.error)}
                        onRetry={() => void workspacesQuery.refetch()}
                      />
                    </div>
                  ) : workspaces.length === 0 ? (
                    <EmptyState
                      icon={Building2}
                      title="No child workspaces yet"
                      description="Create a workspace for a client, brand or region and invite its own team."
                      action={
                        <Button variant="gradient" onClick={() => setCreateOpen(true)}>
                          <Plus /> Create workspace
                        </Button>
                      }
                    />
                  ) : (
                    <div className="divide-y divide-border/60 dark:divide-white/[0.06]">
                      {workspaces.map((workspace) => (
                        <div
                          key={workspace.id}
                          className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-violet-50/50 dark:hover:bg-white/[0.03] sm:flex-row sm:items-center"
                        >
                          <span
                            className={cn(
                              "flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient-soft text-violet-600 dark:text-violet-300"
                            )}
                          >
                            <Building2 className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold">{workspace.name}</p>
                              <StatusBadge status={workspace.status ?? "ACTIVE"} dot={false} />
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {workspace.slug} · {typeLabel(workspace.type)}
                            </p>
                          </div>
                          {workspace.role ? <RoleBadge role={workspace.role} /> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="preferences" className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Choose how comGpt looks on this device.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-secondary/30 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-gradient-soft text-violet-600 dark:text-violet-300">
                    <Palette className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Theme</p>
                    <p className="text-xs text-muted-foreground">Switch between light and dark mode.</p>
                  </div>
                </div>
                <ThemeToggle />
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Theme follows your system preference until you toggle it.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Stored only in this browser. Nothing is sent to the server.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border/60 dark:divide-white/[0.06]">
                <PreferenceRow
                  id="pref-product-updates"
                  title="Product updates"
                  description="Show in-app notes when new comGpt capabilities ship."
                  checked={preferences.productUpdates}
                  onCheckedChange={(checked) => setPreference("productUpdates", checked)}
                />
                <PreferenceRow
                  id="pref-weekly-digest"
                  title="Weekly performance digest"
                  description="Remind me to review campaign performance at the start of each week."
                  checked={preferences.weeklyDigest}
                  onCheckedChange={(checked) => setPreference("weeklyDigest", checked)}
                />
                <PreferenceRow
                  id="pref-desktop-alerts"
                  title="Desktop alerts"
                  description="Allow browser notifications for replies and campaign milestones."
                  checked={preferences.desktopAlerts}
                  onCheckedChange={(checked) => setPreference("desktopAlerts", checked)}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4 dark:border-white/[0.06]">
                <Badge variant="secondary">
                  <Bell /> Saved on this device
                </Badge>
                <Button variant="ghost" size="sm" onClick={resetPreferences}>
                  <RotateCcw /> Reset preferences
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Workspace preferences vs. account settings</CardTitle>
              <CardDescription>
                Preferences on this page only affect your browser. Workspace-wide changes belong on the Workspace tab
                and are visible to every member.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Palette, label: "Local only", copy: "Theme and notification preferences never leave this device." },
                  { icon: Building2, label: "Workspace-wide", copy: "Name, timezone and type apply to everyone in the workspace." },
                  { icon: ShieldCheck, label: "Access controlled", copy: "Only owners and admins can change workspace details." }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-border/70 bg-secondary/30 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]"
                    >
                      <Icon className="size-4 text-violet-500" />
                      <p className="mt-2 text-sm font-semibold">{item.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.copy}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about" className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg">
                  <Sparkles className="size-5" />
                </span>
                <div>
                  <CardTitle>comGpt</CardTitle>
                  <CardDescription>The omnichannel growth operating system.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Version</dt>
                  <dd className="mt-1 font-display text-lg font-semibold">{packageJson.version}</dd>
                </div>
                <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Environment</dt>
                  <dd className="mt-1 font-display text-lg font-semibold capitalize">
                    {process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? "development"}
                  </dd>
                </div>
                <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Workspace</dt>
                  <dd className="mt-1 truncate font-display text-lg font-semibold">
                    {currentOrganization?.name ?? "—"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="size-4 text-emerald-500" /> Health endpoints
                </CardTitle>
                <CardDescription>
                  Plain-text paths served by the Spring Boot API. They are not proxied through the web app.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {HEALTH_PATHS.map((endpoint) => (
                  <div
                    key={endpoint.path}
                    className="rounded-2xl border border-border/70 bg-secondary/30 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.03]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Globe2 className="size-3.5 shrink-0 text-violet-500" />
                        <code className="truncate font-mono text-xs font-semibold">{endpoint.path}</code>
                      </div>
                      <CopyButton value={endpoint.path} label="Copy" />
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      <span className="font-semibold text-foreground/80">{endpoint.label}.</span> {endpoint.description}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-violet-500" /> Security notes
                </CardTitle>
                <CardDescription>How comGpt keeps workspace data and credentials protected.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {SECURITY_NOTES.map((note) => (
                    <li key={note} className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
                      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                      {note}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizationId={organizationId}
        parentName={currentOrganization?.name}
      />
    </div>
  );
}
