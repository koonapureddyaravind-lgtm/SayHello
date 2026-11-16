import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Couldn't load this view",
  message = "The server returned an unexpected response. Try again in a moment.",
  onRetry
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-rose-200/60 bg-rose-50/50 px-6 py-14 text-center dark:border-rose-500/20 dark:bg-rose-500/[0.06]">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 to-red-600 text-white shadow-[0_12px_30px_-12px_rgba(244,63,94,0.6)]">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      ) : null}
    </div>
  );
}
