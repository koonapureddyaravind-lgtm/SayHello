"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-brand-gradient text-white shadow-[0_10px_30px_-10px_rgba(124,58,237,0.65)] hover:shadow-[0_16px_40px_-12px_rgba(217,70,239,0.7)] hover:brightness-[1.06]",
        gradient:
          "bg-brand-gradient text-white shadow-[0_10px_30px_-10px_rgba(124,58,237,0.65)] hover:shadow-[0_16px_40px_-12px_rgba(217,70,239,0.7)] hover:brightness-[1.06]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 dark:bg-white/[0.08] dark:hover:bg-white/[0.12]",
        outline:
          "border border-border bg-card/60 text-foreground shadow-sm backdrop-blur hover:border-violet-300/70 hover:bg-violet-50/60 dark:hover:border-violet-500/40 dark:hover:bg-white/[0.06]",
        ghost: "text-foreground/80 hover:bg-violet-50/70 hover:text-violet-700 dark:hover:bg-white/[0.07] dark:hover:text-white",
        destructive:
          "bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-[0_10px_30px_-12px_rgba(244,63,94,0.7)] hover:brightness-110",
        success:
          "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_10px_30px_-12px_rgba(16,185,129,0.7)] hover:brightness-110",
        soft: "bg-violet-100 text-violet-700 hover:bg-violet-200/80 dark:bg-violet-500/15 dark:text-violet-200 dark:hover:bg-violet-500/25",
        link: "text-violet-600 underline-offset-4 hover:underline dark:text-violet-300"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-2xl px-6 text-base",
        icon: "size-10 rounded-xl",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-12 rounded-2xl"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading ? <Loader2 className="animate-spin" /> : null}
            {children}
          </>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
