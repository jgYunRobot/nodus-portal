import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";

export function PortalProviders({ children }: { children: ReactNode }) {
  const [query_client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 5000 } }
      })
  );
  return (
    <QueryClientProvider client={query_client}>{children}</QueryClientProvider>
  );
}
