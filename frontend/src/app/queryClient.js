import { QueryClient } from "@tanstack/react-query";

// Never retry auth/validation errors; refetch-on-focus off to avoid surprise reloads of sensitive screens.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: (n, e) => ![401, 403, 404, 422].includes(e?.status) && n < 2, refetchOnWindowFocus: false } },
});
