"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCompact } from "@/lib/format";

export interface DonutDatum {
  name: string;
  value: number;
  color: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: DonutDatum }>;
}

function DonutTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  return (
    <div className="rounded-xl border border-violet-200/60 bg-card/95 px-3 py-2 shadow-float backdrop-blur-xl dark:border-white/10 dark:bg-[#171026]/95">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ background: item?.color }} />
        <span className="text-xs font-medium text-muted-foreground">{item?.name}</span>
      </div>
      <p className="mt-0.5 font-display text-lg font-semibold">{formatCompact(payload[0]?.value ?? 0)}</p>
    </div>
  );
}

export function ChannelDonut({
  data,
  total,
  label = "Total sent",
  height = 220
}: {
  data: DonutDatum[];
  total: number;
  label?: string;
  height?: number;
}) {
  return (
    <div className="relative" style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="66%"
            outerRadius="92%"
            paddingAngle={3}
            strokeWidth={0}
            animationDuration={700}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        <span className="mt-0.5 font-display text-2xl font-semibold">{formatCompact(total)}</span>
      </div>
    </div>
  );
}
