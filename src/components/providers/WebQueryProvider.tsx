"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WebAnalyticsBridge } from "@/components/analytics/WebAnalyticsBridge";

export function WebQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnReconnect: true,
            refetchOnWindowFocus: true,
            retry: 1,
            staleTime: 15_000
          }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WebAnalyticsBridge />
      {children}
    </QueryClientProvider>
  );
}
