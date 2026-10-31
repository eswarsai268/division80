import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useMe } from "../auth/useMe";
import { isOfflineFallbackError, readOfflineRoster, searchOfflineRoster } from "../services/offlineRoster";

export const HOUSEHOLD_FILTERS = [
  ["UNVERIFIED", "Not verified"],
  ["RESOLVED", "Verified"],
  ["", "All houses"],
];

const OFFLINE_ROSTER_MESSAGE = "No offline roster is saved on this device yet. Reconnect, sign in as a booth member, and wait until the offline roster download is complete.";

async function getOfflineRoster() {
  const cached = await readOfflineRoster();
  if (!cached) throw new Error(OFFLINE_ROSTER_MESSAGE);
  return cached;
}

function readFilters(storageKey) {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

function saveFilters(storageKey, filters) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(filters));
  } catch {
    // Search still works when browser storage is unavailable.
  }
}

export function useHouseholdSearch({ storageKey = "boothHouseholdFilters", requireSearch = false, searchField = "all" } = {}) {
  const { data: me } = useMe();
  const [initialFilters] = useState(() => readFilters(storageKey));
  const [search, setSearchValue] = useState(() => initialFilters.search ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(() => (initialFilters.search ?? "").trim());
  const [status, setStatusValue] = useState(() => initialFilters.status ?? "");
  const [boothId, setBoothIdValue] = useState(() => initialFilters.boothId ?? "");

  const booths = useQuery({
    queryKey: ["booth", "organization-booths"],
    queryFn: async ({ signal }) => {
      if (me?.isOffline || !navigator.onLine) {
        const cached = await getOfflineRoster();
        return cached.booths;
      }
      try {
        return await api("/booth/booths", { signal });
      } catch (error) {
        if (!isOfflineFallbackError(error)) throw error;
        const cached = await getOfflineRoster();
        return cached.booths;
      }
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!booths.isSuccess || booths.isFetching || !boothId) return;
    if (booths.data.some((booth) => booth.id === boothId)) return;
    setBoothIdValue("");
    saveFilters(storageKey, { search, status, boothId: "" });
  }, [booths.data, booths.isFetching, booths.isSuccess, boothId, search, status, storageKey]);

  const query = useInfiniteQuery({
    queryKey: ["booth", "households", boothId, debouncedSearch, status, searchField],
    enabled: !requireSearch || Boolean(debouncedSearch),
    initialPageParam: null,
    queryFn: async ({ pageParam, signal }) => {
      if (me?.isOffline || !navigator.onLine) {
        const cached = await getOfflineRoster();
        return searchOfflineRoster(cached, { search: debouncedSearch, status, boothId, cursor: pageParam, searchField });
      }
      const params = new URLSearchParams({ limit: "1000" });
      if (boothId) params.set("boothId", boothId);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (searchField !== "all") params.set("searchField", searchField);
      if (status) params.set("status", status);
      if (pageParam) params.set("cursor", pageParam);
      try {
        return await api(`/booth/households?${params}`, { signal });
      } catch (error) {
        if (!isOfflineFallbackError(error)) throw error;
        const cached = await getOfflineRoster();
        return searchOfflineRoster(cached, { search: debouncedSearch, status, boothId, cursor: pageParam, searchField });
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  useEffect(() => {
    if (debouncedSearch && query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [debouncedSearch, query.fetchNextPage, query.hasNextPage, query.isFetchingNextPage]);

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const orderedItems = debouncedSearch
    ? [...items].sort((a, b) => (a.searchRank ?? 99) - (b.searchRank ?? 99))
    : items;

  function setSearch(value) {
    setSearchValue(value);
    saveFilters(storageKey, { search: value, status, boothId });
  }

  function setStatus(value) {
    setStatusValue(value);
    saveFilters(storageKey, { search, status: value, boothId });
  }

  function setBoothId(value) {
    setBoothIdValue(value);
    saveFilters(storageKey, { search, status, boothId: value });
  }

  return {
    booths,
    boothId,
    debouncedSearch,
    items,
    orderedItems,
    query,
    search,
    setBoothId,
    setSearch,
    setStatus,
    status,
    totals: query.data?.pages[0],
  };
}
