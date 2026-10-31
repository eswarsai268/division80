import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import Async from "../../components/Async";
import Empty from "../../components/Empty";
import ErrorBox from "../../components/ErrorBox";
import Title from "../../components/Title";
import { api, post } from "../../api/client";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";

export default function AdminDeadPeople() {
    const [search, setSearch] = useState("");
    const [boothId, setBooth] = useState("");
    const [filter, setFilter] = useState("all");
    const q = useInfiniteQuery({
        queryKey: ["admin", "dead-people", search, boothId, filter],
        initialPageParam: null,
        queryFn: ({ pageParam, signal }) => {
            const params = new URLSearchParams({ limit: "50", frozen: filter });
            if (search.trim()) params.set("search", search.trim());
            if (boothId) params.set("boothId", boothId);
            if (pageParam) params.set("cursor", pageParam);
            return api(`/admin/dead-people?${params}`, { signal });
        },
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    });
    const records = q.data?.pages.flatMap((page) => page.items) ?? [];
    const booths = useGet(["admin", "booths"], "/admin/booths");
    const freeze = useAct((id) => post(`/admin/dead-people/${id}/freeze`, {}));
    const unfreeze = useAct((id) => post(`/admin/dead-people/${id}/unfreeze`, {}));
    return <div className="space-y-3"><Title>{t("Dead people locking")}</Title>
    <p className="text-sm text-slate-600">{t("Deceased citizens reported by booth members. Freeze a record to prevent any further modification by booth members.")}</p>
    <div className="flex gap-2">
        {["all", "unfrozen", "frozen"].map((f) => <button key={f} onClick={() => setFilter(f)} className={`btn-ghost flex-1 ${filter === f ? "!bg-brand-600 !text-white" : ""}`}>{t(f === "all" ? "All" : f === "frozen" ? "Frozen" : "Pending freeze")}</button>)}
    </div>
    <input className="input" placeholder={t("Search name, voter ID, or house")} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t("Search")} />
    <select className="input" value={boothId} onChange={(e) => setBooth(e.target.value)} aria-label={t("Booth filter")}><option value="">{t("All booths")}</option>{booths.data?.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select>
    {(freeze.error || unfreeze.error) && <ErrorBox error={freeze.error ?? unfreeze.error} />}
    <Async q={q}>{() => records.length ? <>
        {records.map((r) => <div key={r.id} className="card mb-2 text-sm">
            <div className="flex justify-between gap-2">
                <span className="font-medium">{r.fullName}</span>
                <span className="text-xs text-slate-500">{r.boothCode} · {r.houseCode}</span>
            </div>
            <p className="text-xs text-slate-500">{t("Voter ID")}: {r.voterId ?? "—"} · {r.age ?? "—"} {t("years")} · {t(r.gender)}</p>
            <p className="text-xs text-slate-500">{r.isFrozen ? `${t("Frozen")}: ${r.frozenByName ?? "—"} (${r.frozenAt ? new Date(r.frozenAt).toLocaleString() : ""})` : t("Not frozen — booth members can still modify")}</p>
            <div className="mt-2 flex justify-end">
                {r.isFrozen
                    ? <button type="button" className="btn-ghost text-xs" disabled={unfreeze.isPending} onClick={() => confirm(`${t("Unfreeze")} ${r.fullName}?`) && unfreeze.mutate(r.id)}>{t("Unfreeze")}</button>
                    : <button type="button" className="btn text-xs" disabled={freeze.isPending} onClick={() => confirm(`${t("Freeze")} ${r.fullName}? ${t("Booth members will no longer be able to modify this record.")}`) && freeze.mutate(r.id)}>{t("Freeze")}</button>}
            </div>
        </div>)}
        {q.hasNextPage && <button type="button" className="btn w-full" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>{t(q.isFetchingNextPage ? "Loading…" : "Show more records")}</button>}
    </> : <Empty text={t("No deceased citizens found.")}/>}</Async></div>;
}