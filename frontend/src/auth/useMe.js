import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "../services/authService";

export const useMe = () =>
  useQuery({
    queryKey: ["me"],
    queryFn: ({ signal }) => fetchMe(signal),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });
