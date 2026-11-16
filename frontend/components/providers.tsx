"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceProvider } from "@/components/providers/workspace-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false
          },
          mutations: {
            retry: 0
          }
        }
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={250}>
          <WorkspaceProvider>{children}</WorkspaceProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              classNames: {
                toast:
                  "!rounded-2xl !border-border/70 !bg-card/95 !text-card-foreground !shadow-float !backdrop-blur-xl dark:!border-white/10 dark:!bg-[#171026]/95"
              }
            }}
          />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
