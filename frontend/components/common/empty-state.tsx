import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <div className="relative mb-5">
        <div className="absolute inset-0 -z-10 rounded-full bg-brand-gradient opacity-20 blur-2xl" />
        <div className="flex size-16 items-center justify-center rounded-2xl border border-white/40 bg-brand-gradient-soft shadow-soft dark:border-white/10">
          <Icon className="size-7 text-violet-600 dark:text-violet-300" />
        </div>
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description ? <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
