import { QueryClient } from "@tanstack/react-query";

// Refresh stale data after returning to the app or reconnecting; never retry auth/validation errors.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (n, e) => e?.status !== 0 && ![401, 403, 404, 422].includes(e?.status) && n < 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});
