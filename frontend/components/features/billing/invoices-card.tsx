"use client";

import * as React from "react";
import { Eye, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StatusBadge } from "@/components/common/status-badge";
import { parseInvoiceLines } from "@/components/features/billing/billing-utils";
import { formatCurrency, formatDate, formatMicros, formatNumber } from "@/lib/format";
import type { Invoice } from "@/lib/types";

function invoicePeriod(invoice: Invoice): string {
  return `${formatDate(invoice.periodStart, "MMM d")} – ${formatDate(invoice.periodEnd, "MMM d, yyyy")}`;
}

export function InvoicesCard({
  invoices,
  isLoading,
  isError,
  onRetry
}: {
  invoices?: Invoice[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const [selected, setSelected] = React.useState<Invoice | null>(null);
  const rows = invoices ?? [];
  const lines = parseInvoiceLines(selected?.lineItems);
  const currency = selected?.currency ?? "USD";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle>Invoices</CardTitle>
            {rows.length > 0 ? <Badge variant="secondary">{rows.length}</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Billing history, receipts and line-item detail.</p>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {isLoading ? (
          <div className="space-y-3 px-6 pb-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="px-6 pb-6">
            <ErrorState
              title="Invoices unavailable"
              message="We couldn't load your billing history."
              onRetry={onRetry}
            />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No invoices yet"
            description="Invoices appear here after your first billing cycle completes."
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Invoice</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Due / paid</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[96px] pr-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="pl-6">
                        <p className="font-semibold">{invoice.number}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Created {formatDate(invoice.createdAt)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{invoicePeriod(invoice)}</TableCell>
                      <TableCell className="text-sm">
                        {invoice.paidAt ? (
                          <span className="text-emerald-600 dark:text-emerald-300">
                            Paid {formatDate(invoice.paidAt)}
                          </span>
                        ) : invoice.dueAt ? (
                          <span className="text-muted-foreground">Due {formatDate(invoice.dueAt)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(invoice.totalCents, invoice.currency)}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelected(invoice)}>
                          <Eye /> Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y divide-border/60 md:hidden dark:divide-white/[0.06]">
              {rows.map((invoice) => (
                <div key={invoice.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{invoice.number}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{invoicePeriod(invoice)}</p>
                    </div>
                    <StatusBadge status={invoice.status} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {invoice.paidAt
                        ? `Paid ${formatDate(invoice.paidAt)}`
                        : invoice.dueAt
                          ? `Due ${formatDate(invoice.dueAt)}`
                          : "—"}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{formatCurrency(invoice.totalCents, invoice.currency)}</span>
                      <Button variant="ghost" size="icon-sm" onClick={() => setSelected(invoice)} aria-label="Invoice details">
                        <Eye />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {selected ? (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle>Invoice {selected.number}</DialogTitle>
                  <StatusBadge status={selected.status} />
                </div>
                <DialogDescription>
                  {invoicePeriod(selected)} · {selected.currency}
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[300px] space-y-3 overflow-y-auto rounded-2xl border border-border/60 bg-secondary/20 p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  <span>Description</span>
                  <span>Amount</span>
                </div>
                {lines.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">No line items on this invoice.</p>
                ) : (
                  lines.map((line, index) => {
                    const unitPrice =
                      line.unitAmountCents !== undefined
                        ? formatCurrency(line.unitAmountCents, currency)
                        : undefined;
                    const perThousand =
                      line.unitCostMicros !== undefined && line.unitCostMicros > 0
                        ? formatMicros(line.unitCostMicros * 1000, currency)
                        : undefined;
                    return (
                      <div
                        key={`${line.description}-${index}`}
                        className="flex items-start justify-between gap-4 border-t border-border/50 pt-3 text-sm first:border-0 first:pt-0 dark:border-white/[0.06]"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{line.description}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {line.quantity === undefined
                              ? "—"
                              : perThousand
                                ? `${formatNumber(line.quantity)} × ${perThousand} / 1k`
                                : `${formatNumber(line.quantity)}${unitPrice ? ` × ${unitPrice}` : " units"}`}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {line.amountCents !== undefined ? formatCurrency(line.amountCents, currency) : "—"}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="space-y-2 rounded-2xl border border-border/60 bg-card/60 p-4 text-sm dark:border-white/[0.06] dark:bg-white/[0.02]">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(selected.subtotalCents, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span className="tabular-nums">{formatCurrency(selected.taxCents, currency)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border/60 pt-2 font-display text-base font-semibold dark:border-white/[0.06]">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(selected.totalCents, currency)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-2xl bg-secondary/50 p-3 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Due date</p>
                  <p className="mt-1 font-medium">{formatDate(selected.dueAt)}</p>
                </div>
                <div className="rounded-2xl bg-secondary/50 p-3 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Paid date</p>
                  <p className="mt-1 font-medium">{formatDate(selected.paidAt)}</p>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
