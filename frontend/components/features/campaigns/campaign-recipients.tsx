"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { UsersRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Pagination } from "@/components/common/pagination";
import { StatusBadge } from "@/components/common/status-badge";
import { apiFetch } from "@/lib/api";
import { formatDate, truncate } from "@/lib/format";
import type { CampaignRecipient, PageResponse } from "@/lib/types";
import { RECIPIENT_STATUSES } from "./campaign-utils";

export function CampaignRecipients({ campaignId }: { campaignId: string }) {
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const [status, setStatus] = React.useState<string>("ALL");

  const recipientsQuery = useQuery({
    queryKey: ["campaigns", "recipients", campaignId, { page, size, status }],
    queryFn: () =>
      apiFetch<PageResponse<CampaignRecipient>>(`/campaigns/${campaignId}/recipients`, {
        query: { page, size, status: status === "ALL" ? undefined : status }
      })
  });

  const recipients = recipientsQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Recipients</CardTitle>
          <CardDescription>Everyone who was targeted by this campaign.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-9 w-[150px] rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {RECIPIENT_STATUSES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option.charAt(0) + option.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="px-0 pb-0">
        {recipientsQuery.isLoading ? (
          <div className="space-y-2 px-6 pb-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : recipientsQuery.isError ? (
          <div className="px-6 pb-6">
            <ErrorState
              title="Recipients unavailable"
              message="We couldn't load the recipient list for this campaign."
              onRetry={() => void recipientsQuery.refetch()}
            />
          </div>
        ) : recipients.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title={status === "ALL" ? "No recipients yet" : "No recipients with this status"}
            description={
              status === "ALL"
                ? "Recipients are added when the campaign is prepared for sending."
                : "Try another status filter to see more of the audience."
            }
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px] pl-6">Contact</TableHead>
                  <TableHead className="min-w-[180px]">Address</TableHead>
                  <TableHead className="min-w-[110px]">Status</TableHead>
                  <TableHead className="min-w-[180px]">Skip reason</TableHead>
                  <TableHead className="min-w-[140px] pr-6">Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.map((recipient) => (
                  <TableRow key={recipient.id}>
                    <TableCell className="pl-6">
                      <p className="text-sm font-semibold">{recipient.contactName?.trim() || "Contact"}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{truncate(recipient.contactId, 18)}</p>
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      <span className="block truncate text-sm text-muted-foreground">
                        {recipient.contactAddress?.trim() || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={recipient.status} />
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <span className="block truncate text-xs text-muted-foreground">
                        {recipient.skipReason?.trim() || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="pr-6 text-xs text-muted-foreground">
                      {recipient.createdAt ? formatDate(recipient.createdAt, "MMM d, HH:mm") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {recipientsQuery.data && recipientsQuery.data.totalItems > 0 ? (
        <Pagination
          page={recipientsQuery.data.page}
          totalPages={recipientsQuery.data.totalPages}
          totalItems={recipientsQuery.data.totalItems}
          size={recipientsQuery.data.size}
          onPageChange={setPage}
          onSizeChange={(nextSize) => {
            setSize(nextSize);
            setPage(0);
          }}
        />
      ) : null}
    </Card>
  );
}
