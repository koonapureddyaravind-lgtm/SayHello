import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-violet-200/60 bg-violet-100/80 text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/15 dark:text-violet-200",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border bg-transparent text-foreground/80",
        success:
          "border-emerald-200/70 bg-emerald-100/80 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/15 dark:text-emerald-200",
        warning:
          "border-amber-200/70 bg-amber-100/80 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/15 dark:text-amber-200",
        danger: "border-rose-200/70 bg-rose-100/80 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/15 dark:text-rose-200",
        info: "border-sky-200/70 bg-sky-100/80 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/15 dark:text-sky-200",
        purple:
          "border-fuchsia-200/70 bg-fuchsia-100/80 text-fuchsia-700 dark:border-fuchsia-400/20 dark:bg-fuchsia-500/15 dark:text-fuchsia-200",
        gradient: "border-transparent bg-brand-gradient text-white shadow-sm"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
