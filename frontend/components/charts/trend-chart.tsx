"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact, formatDate } from "@/lib/format";
import type { TimeseriesPoint } from "@/lib/types";

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-violet-200/60 bg-card/95 px-3 py-2 shadow-float backdrop-blur-xl dark:border-white/10 dark:bg-[#171026]/95">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{formatDate(label, "EEE, MMM d")}</p>
      <p className="mt-1 font-display text-lg font-semibold" style={{ color: payload[0]?.color }}>
        {formatCompact(payload[0]?.value ?? 0)}
      </p>
    </div>
  );
}

export function TrendChart({
  data,
  color = "#7c3aed",
  height = 280,
  showGrid = true
}: {
  data: TimeseriesPoint[];
  color?: string;
  height?: number;
  showGrid?: boolean;
}) {
  const gradientId = `trend-${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="55%" stopColor={color} stopOpacity={0.12} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {showGrid ? <CartesianGrid strokeDasharray="4 6" stroke="rgba(124,58,237,0.12)" vertical={false} /> : null}
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => formatDate(value, "MMM d")}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }}
            minTickGap={28}
            dy={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }}
            tickFormatter={(value: number) => formatCompact(value)}
            width={48}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "4 4" }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
