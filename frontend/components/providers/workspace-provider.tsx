"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api";
import type { MeResponse, OrganizationSummary, User } from "@/lib/types";

interface WorkspaceContextValue {
  user: User | null;
  organizations: OrganizationSummary[];
  currentOrganization: OrganizationSummary | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  switchOrganization: (organizationId: string) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [switching, setSwitching] = React.useState(false);

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiFetch<MeResponse>("/auth/me"),
    retry: false,
    staleTime: 60_000
  });

  const organizations = React.useMemo(() => meQuery.data?.organizations ?? [], [meQuery.data]);
  const currentOrganization = React.useMemo(() => {
    const stored = typeof document !== "undefined" ? document.cookie.match(/(?:^|; )of_org=([^;]*)/)?.[1] : undefined;
    const orgId = stored ? decodeURIComponent(stored) : undefined;
    return organizations.find((org) => org.id === orgId) ?? organizations[0] ?? null;
  }, [organizations]);

  const switchOrganization = React.useCallback(
    async (organizationId: string) => {
      setSwitching(true);
      try {
        const response = await fetch("/api/org/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId })
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Unable to switch workspace");
        }
        await queryClient.invalidateQueries();
        router.refresh();
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setSwitching(false);
      }
    },
    [queryClient, router]
  );

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.clear();
      router.push("/login");
      router.refresh();
    }
  });

  const refresh = React.useCallback(async () => {
    await meQuery.refetch();
  }, [meQuery]);

  const value = React.useMemo<WorkspaceContextValue>(
    () => ({
      user: meQuery.data?.user ?? null,
      organizations,
      currentOrganization,
      isLoading: meQuery.isLoading || switching || logoutMutation.isPending,
      isAuthenticated: Boolean(meQuery.data?.user),
      switchOrganization,
      refresh,
      logout: async () => {
        await logoutMutation.mutateAsync();
      }
    }),
    [meQuery.data, organizations, currentOrganization, meQuery.isLoading, switching, logoutMutation, switchOrganization, refresh]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = React.useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
