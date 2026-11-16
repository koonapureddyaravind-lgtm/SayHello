"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";

export function Pagination({
  page,
  totalPages,
  totalItems,
  size,
  onPageChange,
  onSizeChange,
  className
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  size: number;
  onPageChange: (page: number) => void;
  onSizeChange?: (size: number) => void;
  className?: string;
}) {
  const from = totalItems === 0 ? 0 : page * size + 1;
  const to = Math.min(totalItems, (page + 1) * size);
  const pages = Math.max(1, totalPages);

  return (
    <div className={cn("flex flex-col gap-3 border-t border-border/60 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          Showing <span className="font-semibold text-foreground">{formatNumber(from)}</span>–
          <span className="font-semibold text-foreground">{formatNumber(to)}</span> of{" "}
          <span className="font-semibold text-foreground">{formatNumber(totalItems)}</span>
        </span>
        {onSizeChange ? (
          <div className="flex items-center gap-1.5">
            <span>Rows</span>
            <Select value={String(size)} onValueChange={(value) => onSizeChange(Number(value))}>
              <SelectTrigger className="h-8 w-[72px] rounded-lg px-2 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 0}>
          <ChevronLeft className="size-4" /> Previous
        </Button>
        <span className="px-2 text-xs font-medium text-muted-foreground">
          Page {page + 1} of {pages}
        </span>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page + 1 >= pages}>
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
