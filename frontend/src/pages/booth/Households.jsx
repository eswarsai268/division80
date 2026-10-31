import { ArrowRight, Building2, ChevronDown, Search, Users, X } from "lucide-react";
import { Link } from "react-router-dom";
import Async from "../../components/Async";
import Empty from "../../components/Empty";
import { HOUSEHOLD_FILTERS, useHouseholdSearch } from "../../hooks/useHouseholdSearch";
import { t } from "../../i18n";

export default function Households() {
    const { booths, boothId, debouncedSearch, items, orderedItems, query, search, setBoothId, setSearch, setStatus, status, totals } = useHouseholdSearch();

    return <div className="space-y-4">
      <header className="rounded-3xl bg-brand-600 p-5 text-white shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider">{t("Door-to-door visit")}</p>
        <h1 className="mt-1 text-2xl font-extrabold">{t("Organization houses")}</h1>
        <p className="mt-2 text-sm">{t("View houses across your organization. Visit updates are limited to your assigned booths.")}</p>
      </header>

      <Async q={booths}>{(available) => available.length ? <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><Building2 size={23}/></span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-slate-500">{t("Organization booths")}</span>
        <select className="mt-1 w-full bg-transparent text-base font-bold text-slate-900 focus:outline-none" value={boothId} onChange={(event) => setBoothId(event.target.value)} aria-label={t("Choose booth")}>
            <option value="">{t("All organization booths")}</option>
            {available.map((booth) => <option key={booth.id} value={booth.id}>{booth.name} · {t("Booth")} {booth.code}</option>)}
          </select>
        </span>
        <ChevronDown className="shrink-0 text-amber-600" size={20}/>
      </label> : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{t("No active booths are available in your organization.")}</div>}</Async>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-1.5 shadow-sm" role="tablist" aria-label={t("Filter houses")}>
        {HOUSEHOLD_FILTERS.map(([value, label]) => <button key={value || "all"} type="button" role="tab" aria-selected={status === value} onClick={() => setStatus(value)}
          className={`min-h-11 rounded-xl px-2 text-sm font-semibold ${status === value ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>{t(label)}</button>)}
      </div>

      <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
        <Search className="shrink-0 text-slate-500" size={21}/>
        <input className="w-full bg-transparent text-base outline-none placeholder:text-slate-400" value={search} maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("Search house, serial, name or voter ID")} aria-label={t("Search house, serial, name or voter ID")}/>
        {search && <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100" onClick={() => setSearch("")} aria-label={t("Clear search")} title={t("Clear search")}><X size={18}/></button>}
      </div>

      {totals && <p role="status" className="rounded-xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">{totals.offline || !navigator.onLine ? "Saved offline roster results:" : "Database results for these filters:"} <strong className="text-slate-900">{totals.totalHouseholds.toLocaleString()} houses</strong> with <strong className="text-slate-900">{totals.totalPeople.toLocaleString()} people</strong>. Showing {orderedItems.length.toLocaleString()} house cards.</p>}
      <Async q={query}>{() => items.length ? <section className="space-y-3" aria-label={t("House list")}>
        {orderedItems.map((house) => <div key={house.id}><Link to={`/booth/households/${house.id}`} className="flex min-h-24 items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-inherit no-underline shadow-sm transition hover:border-amber-300 hover:shadow-md">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-amber-100 bg-amber-50 text-amber-700"><Users size={23}/></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xl font-extrabold text-slate-900">{t("House")} {house.houseCode}</span>
            <span className="mt-1 block truncate text-xs text-slate-500">{house.boothName} · {t("Booth")} {house.boothCode} · {house.citizenCount} {t("people")}</span>
            <span className="mt-1 block text-xs font-semibold text-emerald-700">{t("Visited")}: {house.visitedCount}/{house.citizenCount}</span>
{house.visitedCount > 0 && <span className="mt-1 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">{t("Verified")}: {house.visitedCount}/{house.citizenCount}</span>}
          </span>
          <ArrowRight className="shrink-0 text-slate-500" size={21}/>
        </Link>
        {house.matchingCitizens?.length > 0 && <div className="mt-2 rounded-xl border border-amber-300 bg-amber-100/80 px-4 py-3 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900">{t("Matching people")}</p>
          <div className="mt-1.5 space-y-1.5">{house.matchingCitizens.map((person) => <div key={person.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-bold text-slate-900">{person.fullName}</span>
            {person.fatherOrHusbandName && <span className="text-amber-950">{t("Father / husband")}: <strong>{person.fatherOrHusbandName}</strong></span>}
          </div>)}</div>
        </div>}
        </div>)}
        {debouncedSearch && query.isFetchingNextPage && <p className="py-2 text-center text-sm text-slate-600" role="status">{t("Loading matching houses…")}</p>}
        {query.hasNextPage && !debouncedSearch && <button className="btn w-full min-h-12 rounded-xl" type="button" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
          {t(query.isFetchingNextPage ? "Loading houses…" : "Show more houses")}
        </button>}
      </section> : <Empty text="No houses found."/>}</Async>
    </div>;
}
