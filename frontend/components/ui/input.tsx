"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", leftIcon, rightSlot, ...props }, ref) => {
    if (leftIcon || rightSlot) {
      return (
        <div className="relative flex w-full items-center">
          {leftIcon ? (
            <span className="pointer-events-none absolute left-3.5 flex text-muted-foreground [&_svg]:size-4">{leftIcon}</span>
          ) : null}
          <input
            type={type}
            className={cn(
              "flex h-11 w-full rounded-xl border border-input bg-card/70 px-3.5 py-2 text-sm text-foreground shadow-sm backdrop-blur transition-all placeholder:text-muted-foreground/70 focus-visible:border-violet-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/[0.04]",
              leftIcon && "pl-10",
              rightSlot && "pr-11",
              className
            )}
            ref={ref}
            {...props}
          />
          {rightSlot ? <span className="absolute right-3.5 flex items-center text-muted-foreground">{rightSlot}</span> : null}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-input bg-card/70 px-3.5 py-2 text-sm text-foreground shadow-sm backdrop-blur transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/70 focus-visible:border-violet-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/[0.04]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
