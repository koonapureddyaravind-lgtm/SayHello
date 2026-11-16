import { cn } from "@/lib/cn";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("shimmer-bg rounded-xl", className)} {...props} />;
}

export { Skeleton };
