import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, ChevronDown, Search, Users, X } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import Async from "../../components/Async";
import Empty from "../../components/Empty";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";

const FILTERS = [
    ["UNVERIFIED", "Not verified"],
    ["RESOLVED", "Verified"],
    ["", "All houses"],
];
const FILTER_STORAGE_KEY = "boothHouseholdFilters";
function readFilters() {
    try {
        return JSON.parse(sessionStorage.getItem(FILTER_STORAGE_KEY) ?? "{}") ?? {};
    } catch {
        return {};
    }
}
function saveFilters(filters) {
    try {
        sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch {
        // Search still works when browser storage is unavailable.
    }
}

export default function Households() {
    const [search, setSearch] = useState(() => readFilters().search ?? "");
    const [debouncedSearch, setDebouncedSearch] = useState(() => (readFilters().search ?? "").trim());
    const [status, setStatus] = useState(() => readFilters().status ?? "");
    const [boothId, setBoothId] = useState(() => readFilters().boothId ?? "");
    const booths = useGet(["booth", "assigned-booths"], "/booth/booths");
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);
    const query = useInfiniteQuery({
        queryKey: ["booth", "households", boothId, debouncedSearch, status],
        initialPageParam: null,
        queryFn: ({ pageParam, signal }) => {
            const params = new URLSearchParams({ limit: "1000" });
            if (boothId)
                params.set("boothId", boothId);
            if (debouncedSearch)
                params.set("search", debouncedSearch);
            if (status)
                params.set("status", status);
            if (pageParam)
                params.set("cursor", pageParam);
            return api(`/booth/households?${params}`, { signal });
        },
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    });
    const items = query.data?.pages.flatMap((page) => page.items) ?? [];
    const totals = query.data?.pages[0];

    return <div className="space-y-4">
      <header className="rounded-3xl bg-[#ffc400] p-5 text-stone-950 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider">{t("Door-to-door visit")}</p>
        <h1 className="mt-1 text-2xl font-extrabold">{t("Your houses")}</h1>
        <p className="mt-2 text-sm">{t("Choose a booth, open a house, then check each person.")}</p>
      </header>

      <Async q={booths}>{(assigned) => assigned.length ? <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><Building2 size={23}/></span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-slate-500">{t("Assigned booths")}</span>
        <select className="mt-1 w-full bg-transparent text-base font-bold text-slate-900 focus:outline-none" value={boothId} onChange={(event) => { const value = event.target.value; setBoothId(value); saveFilters({ search, status, boothId: value }); }} aria-label={t("Choose booth")}>
            <option value="">{t("All my assigned booths")}</option>
            {assigned.map((booth) => <option key={booth.id} value={booth.id}>{booth.name} · {t("Booth")} {booth.code}</option>)}
          </select>
        </span>
        <ChevronDown className="shrink-0 text-amber-600" size={20}/>
      </label> : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{t("No booth is assigned to your account yet. Please ask your administrator for help.")}</div>}</Async>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-1.5 shadow-sm" role="tablist" aria-label={t("Filter houses")}>
        {FILTERS.map(([value, label]) => <button key={value || "all"} type="button" role="tab" aria-selected={status === value} onClick={() => { setStatus(value); saveFilters({ search, status: value, boothId }); }}
          className={`min-h-11 rounded-xl px-2 text-sm font-semibold ${status === value ? "bg-[#ffc400] text-stone-950 shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>{t(label)}</button>)}
      </div>

      <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
        <Search className="shrink-0 text-slate-500" size={21}/>
        <input className="w-full bg-transparent text-base outline-none placeholder:text-slate-400" value={search} maxLength={100}
          onChange={(event) => { const value = event.target.value; setSearch(value); saveFilters({ search: value, status, boothId }); }}
          placeholder={t("Search house, serial, name or voter ID")} aria-label={t("Search house, serial, name or voter ID")}/>
        {search && <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100" onClick={() => { setSearch(""); saveFilters({ search: "", status, boothId }); }} aria-label={t("Clear search")} title={t("Clear search")}><X size={18}/></button>}
      </div>

      {totals && <p role="status" className="rounded-xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">Database results for these filters: <strong className="text-slate-900">{totals.totalHouseholds.toLocaleString()} houses</strong> with <strong className="text-slate-900">{totals.totalPeople.toLocaleString()} people</strong>. Loaded {items.length.toLocaleString()} house cards.</p>}
      <Async q={query}>{() => items.length ? <section className="space-y-3" aria-label={t("House list")}>
        {items.map((house) => <Link key={house.id} to={`/booth/households/${house.id}`} className="flex min-h-24 items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-inherit no-underline shadow-sm transition hover:border-amber-300 hover:shadow-md">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-amber-100 bg-amber-50 text-amber-700"><Users size={23}/></span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-extrabold text-slate-900">{t("House")} {house.houseCode}</span>
            <span className="mt-1 block truncate text-xs text-slate-500">{house.boothName} · {t("Booth")} {house.boothCode} · {house.citizenCount} {t("people")}</span>
            <span className="mt-1 block text-xs font-semibold text-emerald-700">{t("Visited")}: {house.visitedCount}/{house.citizenCount}</span>
          </span>
          <ArrowRight className="shrink-0 text-slate-500" size={21}/>
        </Link>)}
        {query.hasNextPage && <button className="btn w-full min-h-12 rounded-xl" type="button" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
          {t(query.isFetchingNextPage ? "Loading houses…" : "Show more houses")}
        </button>}
      </section> : <Empty text="No houses found."/>}</Async>
    </div>;
}
