import { Building2, ChevronDown, Search, X } from "lucide-react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import Title from "../../components/Title";
import { fmt } from "../../utils/format";
import { HOUSEHOLD_FILTERS, useHouseholdSearch } from "../../hooks/useHouseholdSearch";
import { useGet } from "../../hooks/useGet";
import { useMe } from "../../auth/useMe";
import { api } from "../../api/client";
import { isOfflineFallbackError, readOfflineSnapshot } from "../../services/offlineRoster";
import { t } from "../../i18n";

export default function VerificationsPage() {
    const { data: me } = useMe();
    const {
        booths,
        boothId,
        debouncedSearch,
        orderedItems,
        query: searchQuery,
        search,
        setBoothId,
        setSearch,
        setStatus,
        status,
    } = useHouseholdSearch({ storageKey: "boothRecordSearchFilters", requireSearch: true, searchField: "serial" });
    const matchingRecords = orderedItems.flatMap((house) => (house.searchRecords ?? house.matchingCitizens ?? []).map((person) => ({
        ...person,
        boothCode: house.boothCode,
        boothName: house.boothName,
    })));
    const q = useGet(["booth", "verifications"], "/booth/verifications", {
        queryFn: async ({ signal }) => {
            if (me?.isOffline || !navigator.onLine) {
                const saved = await readOfflineSnapshot("verifications");
                if (saved !== null) return saved;
                throw new Error("Verification history has not been saved on this device. Reconnect and open this page to cache it.");
            }
            try { return await api("/booth/verifications", { signal }); }
            catch (error) {
                if (!isOfflineFallbackError(error)) throw error;
                const saved = await readOfflineSnapshot("verifications");
                if (saved !== null) return saved;
                throw error;
            }
        },
    });
    return <div className="space-y-4">
      <Title>{t("Search voter records")}</Title>
      <Async q={booths}>{(available) => available.length ? <>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><Building2 size={23}/></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-slate-500">{t("Organization booths")}</span>
            <select className="mt-1 w-full bg-transparent text-base font-bold text-slate-900 focus:outline-none" value={boothId} onChange={(event) => setBoothId(event.target.value)} aria-label={t("Choose booth")}>
              <option value="">{t("All organization booths")}</option>
              {available.map((booth) => <option key={booth.id} value={booth.id}>{booth.name} · {t("Booth")} {booth.code}</option>)}
            </select>
          </span>
          <ChevronDown className="shrink-0 text-amber-600" size={20}/>
        </label>
      </> : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{t("No active booths are available in your organization.")}</div>}</Async>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-1.5 shadow-sm" role="tablist" aria-label={t("Filter records")}>
        {HOUSEHOLD_FILTERS.map(([value, label]) => <button key={value || "all"} type="button" role="tab" aria-selected={status === value} onClick={() => setStatus(value)}
          className={`min-h-11 rounded-xl px-2 text-sm font-semibold ${status === value ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>{t(label)}</button>)}
      </div>

      <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
        <Search className="shrink-0 text-slate-500" size={21}/>
        <input className="w-full bg-transparent text-base outline-none placeholder:text-slate-400" value={search} maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("Search S.No.")} aria-label={t("Search S.No.")}/>
        {search && <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100" onClick={() => setSearch("")} aria-label={t("Clear search")} title={t("Clear search")}><X size={18}/></button>}
      </div>

      {debouncedSearch
        ? <Async q={searchQuery}>{() => matchingRecords.length ? <section className="space-y-3" aria-label={t("Matching records")}>
          <p role="status" className="text-sm text-slate-600">{t("Matching records")}: {matchingRecords.length.toLocaleString()}</p>
          {matchingRecords.map((person) => <article key={person.id} className="card">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div><dt className="text-xs font-medium text-slate-500">{t("S.No.")}</dt><dd className="mt-0.5 text-lg font-bold text-slate-900">{person.rollSerial ?? "—"}</dd></div>
              <div className="col-span-2"><dt className="text-xs font-medium text-slate-500">{t("Name")}</dt><dd className="mt-0.5 break-words text-xl font-extrabold text-slate-900">{person.fullName}{person.verificationDone && <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">{t("Verified")}</span>}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">{t("Father / husband")}</dt><dd className="mt-0.5 break-words text-base font-semibold text-slate-900">{person.fatherOrHusbandName || "—"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">{t("Voter ID")}</dt><dd className="mt-0.5 break-all text-base font-semibold text-slate-900">{person.voterId ?? "—"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">{t("Booth number")}</dt><dd className="mt-0.5 text-base font-semibold text-slate-900">{person.boothCode}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">{t("Booth")}</dt><dd className="mt-0.5 break-words text-base font-semibold text-slate-900">{person.boothName}</dd></div>
              <div className="col-span-2"><dt className="text-xs font-medium text-slate-500">{t("Polling station")}</dt><dd className="mt-0.5 break-words text-base font-semibold text-slate-900">{person.pollingStation || t("Not available")}</dd></div>
              <div className="col-span-2"><dt className="text-xs font-medium text-slate-500">{t("Polling address")}</dt><dd className="mt-0.5 break-words text-base font-semibold text-slate-900">{person.pollingAddress || t("Not available")}</dd></div>
            </dl>
            <p className="mt-3 border-t border-slate-200 pt-2 text-sm text-slate-600">{t(person.relation)} · {person.age ?? "—"} {t("years")} · {t(person.gender)}</p>
          </article>)}
        </section> : <Empty text="No matching records found."/>}</Async>
        : <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-600">{t("Enter an S.No. to find matching records.")}</p>}

      <section>
        <Title>{t("Recent verifications")}</Title>
        {q.data?.length > 0 && <p className="mb-2 text-sm text-slate-600">{t("Total")}: {q.data.length} {t("verification records")}</p>}
        <Async q={q}>{(d) => d.length ? <>{d.map((v) => <div key={v.id} className={`card mb-2 text-sm ${v.result === "PASSED" ? "border-l-4 border-emerald-500" : ""}`}><div className="flex justify-between"><span>{t("House")} {v.houseCode} · {v.citizenName}</span><Badge s={v.result}/></div><p className="text-xs text-slate-500">{t("Step")} {v.step} · {v.verifier} · {fmt(v.createdAt)}</p></div>)}</> : <Empty text="No verifications recorded yet."/>}</Async>
      </section>
    </div>;
}
