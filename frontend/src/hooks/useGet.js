import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

/** GET helper: useGet(["key"], "/path", { refetchInterval }) */
export const useGet = (key, path, opts = {}) =>
  useQuery({ queryKey: key, queryFn: ({ signal }) => api(path, { signal }), ...opts });
