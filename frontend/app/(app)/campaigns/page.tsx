"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Plus, Search, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Pagination } from "@/components/common/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardTabs } from "@/components/ui/card-tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CampaignCard } from "@/components/features/campaigns/campaign-card";
import { CampaignFormDialog } from "@/components/features/campaigns/campaign-form-dialog";
import {
  CAMPAIGN_STATUS_TABS,
  CHANNEL_OPTIONS,
  type CampaignStatusTab
} from "@/components/features/campaigns/campaign-utils";
import { apiFetch } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import type { Campaign, Channel, PageResponse, Segment } from "@/lib/types";

function CampaignCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 w-full shimmer-bg" />
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <Skeleton className="size-11 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-1.5 w-full" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </Card>
  );
}

export default function CampaignsPage() {
  const router = useRouter();
  const [statusTab, setStatusTab] = React.useState<CampaignStatusTab>("ALL");
  const [channel, setChannel] = React.useState<"ALL" | Channel>("ALL");
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "1") {
      setCreateOpen(true);
      params.delete("create");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }
  }, []);

  const campaignsQuery = useQuery({
    queryKey: ["campaigns", "list", { page, size, statusTab, channel, q: debouncedSearch }],
    queryFn: () =>
      apiFetch<PageResponse<Campaign>>("/campaigns", {
        query: {
          page,
          size,
          status: statusTab === "ALL" ? undefined : statusTab,
          channel: channel === "ALL" ? undefined : channel,
          q: debouncedSearch || undefined
        }
      })
  });

  const segmentsQuery = useQuery({
    queryKey: ["segments", "options"],
    queryFn: () => apiFetch<PageResponse<Segment>>("/segments", { query: { page: 0, size: 100 } }),
    staleTime: 60_000
  });

  const segmentNames = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const segment of segmentsQuery.data?.items ?? []) {
      map.set(segment.id, segment.name);
    }
    return map;
  }, [segmentsQuery.data]);

  const campaigns = campaignsQuery.data?.items ?? [];
  const activeFilters = statusTab !== "ALL" || channel !== "ALL" || debouncedSearch.length > 0;

  function clearFilters() {
    setStatusTab("ALL");
    setChannel("ALL");
    setSearch("");
    setDebouncedSearch("");
    setPage(0);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Campaigns"
        title="Campaigns"
        description="Plan, schedule and monitor every outbound message across email, WhatsApp and SMS."
        actions={
          <Button variant="gradient" onClick={() => setCreateOpen(true)}>
            <Plus /> New campaign
          </Button>
        }
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <CardTabs
          tabs={CAMPAIGN_STATUS_TABS.map((tab) => ({ value: tab.value, label: tab.label }))}
          value={statusTab}
          onValueChange={(value) => {
            setStatusTab(value as CampaignStatusTab);
            setPage(0);
          }}
          className="w-full xl:w-auto"
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search campaigns…"
            leftIcon={<Search />}
            className="sm:w-64"
            aria-label="Search campaigns"
          />
          <Select
            value={channel}
            onValueChange={(value) => {
              setChannel(value as "ALL" | Channel);
              setPage(0);
            }}
          >
            <SelectTrigger className="sm:w-[170px]" aria-label="Filter by channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All channels</SelectItem>
              {CHANNEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {campaignsQuery.isSuccess ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">
            {formatNumber(campaignsQuery.data.totalItems)} campaign{campaignsQuery.data.totalItems === 1 ? "" : "s"}
            {activeFilters ? " matching your filters" : ""}
          </p>
          {activeFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}

      {campaignsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <CampaignCardSkeleton key={index} />
          ))}
        </div>
      ) : campaignsQuery.isError ? (
        <ErrorState
          title="Campaigns are taking a moment"
          message="We couldn't load your campaigns. Check the filters or try again."
          onRetry={() => void campaignsQuery.refetch()}
        />
      ) : campaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon={Megaphone}
            title={activeFilters ? "No campaigns match those filters" : "Launch your first campaign"}
            description={
              activeFilters
                ? "Try a different status, channel or search term to find what you're looking for."
                : "Create a broadcast or triggered automation and comGpt will track delivery across every channel."
            }
            action={
              activeFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button variant="gradient" onClick={() => setCreateOpen(true)}>
                  <Sparkles /> Create campaign
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              segmentName={campaign.segmentId ? segmentNames.get(campaign.segmentId) : undefined}
            />
          ))}
        </div>
      )}

      {campaignsQuery.data && campaignsQuery.data.totalItems > 0 ? (
        <Pagination
          page={campaignsQuery.data.page}
          totalPages={campaignsQuery.data.totalPages}
          totalItems={campaignsQuery.data.totalItems}
          size={campaignsQuery.data.size}
          onPageChange={setPage}
          onSizeChange={(nextSize) => {
            setSize(nextSize);
            setPage(0);
          }}
        />
      ) : null}

      <CampaignFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(campaign) => router.push(`/campaigns/${campaign.id}`)}
      />
    </div>
  );
}
