import { useMutation, useQueryClient } from "@tanstack/react-query";

/** Mutation helper that refreshes cached server data (default: everything under "admin"). */
export function useAct(fn, invalidate = ["admin"]) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: invalidate }) });
}
