"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[110px] w-full rounded-xl border border-input bg-card/70 px-3.5 py-3 text-sm text-foreground shadow-sm backdrop-blur transition-all placeholder:text-muted-foreground/70 focus-visible:border-violet-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/[0.04]",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
