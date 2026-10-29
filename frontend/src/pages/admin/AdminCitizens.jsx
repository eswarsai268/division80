import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import ErrorBox from "../../components/ErrorBox";
import Title from "../../components/Title";
import { api, patch, post } from "../../api/client";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";

export default function AdminCitizens() {
    const [tab, setTab] = useState("citizens");
    const [search, setSearch] = useState("");
    const [boothId, setBooth] = useState("");
    const [person, setPerson] = useState({ boothId: "", houseCode: "", address: "", rollSerial: "", fullName: "", relation: "", voterId: "", age: "", gender: "UNKNOWN", lifeStatus: "UNKNOWN" });
    const q = useInfiniteQuery({
        queryKey: ["admin", tab, search, boothId],
        initialPageParam: null,
        queryFn: ({ pageParam, signal }) => {
            const params = new URLSearchParams({ limit: "50" });
            if (search.trim())
                params.set("search", search.trim());
            if (boothId)
                params.set("boothId", boothId);
            if (pageParam)
                params.set("cursor", pageParam);
            return api(`/admin/${tab}?${params}`, { signal });
        },
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    });
    const records = q.data?.pages.flatMap((page) => page.items) ?? [];
    const booths = useGet(["admin", "booths"], "/admin/booths");
    const upd = useAct((v) => patch(`/admin/citizens/${v.id}`, { lifeStatus: v.lifeStatus }));
    const del = useAct((id) => api(`/admin/households/${id}`, { method: "DELETE" }));
    const archive = useAct((id) => api(`/admin/citizens/${id}`, { method: "DELETE" }));
    const addPerson = useAct((input) => post("/admin/citizens", input));
    return <div className="space-y-3"><Title>{t("Citizens & households")}</Title>
    <div className="flex gap-2">{["citizens", "households"].map((tabName) => <button key={tabName} onClick={() => setTab(tabName)} className={`btn-ghost flex-1 ${tab === tabName ? "!bg-brand-600 !text-white" : ""}`}>{tabName === "citizens" ? t("Citizens") : t("Households")}</button>)}</div>
    <input className="input" placeholder={tab === "citizens" ? t("Search name, voter ID, or house") : t("Search house e.g. G-24")} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t("Search")}/>
    <select className="input" value={boothId} onChange={(e) => setBooth(e.target.value)} aria-label={t("Booth filter")}><option value="">{t("All booths")}</option>{booths.data?.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select>
    {tab === "citizens" && <form className="card space-y-2" onSubmit={(event) => {
        event.preventDefault();
        addPerson.mutate({ ...person, houseCode: person.houseCode.trim(), fullName: person.fullName.trim(), relation: person.relation.trim(), voterId: person.voterId.trim() || undefined, rollSerial: person.rollSerial.trim() || undefined, address: person.address.trim() || undefined, age: person.age === "" ? null : Number(person.age) }, { onSuccess: () => setPerson({ ...person, houseCode: "", rollSerial: "", fullName: "", relation: "", voterId: "", age: "" }) });
    }}>
      <h2 className="font-semibold">{t("Add one roster member")}</h2>
      <select className="input" required value={person.boothId} onChange={(e) => setPerson({ ...person, boothId: e.target.value })} aria-label={t("Booth")}><option value="">{t("Select booth (required)")}</option>{booths.data?.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}</select>
      <input className="input" required maxLength={32} placeholder={t("House code")} value={person.houseCode} onChange={(e) => setPerson({ ...person, houseCode: e.target.value })}/>
      <input className="input" maxLength={255} placeholder={t("House address (optional)")} value={person.address} onChange={(e) => setPerson({ ...person, address: e.target.value })}/>
      <input className="input" required maxLength={200} placeholder={t("Full name")} value={person.fullName} onChange={(e) => setPerson({ ...person, fullName: e.target.value })}/>
      <input className="input" required maxLength={32} placeholder={t("Relationship")} value={person.relation} onChange={(e) => setPerson({ ...person, relation: e.target.value })}/>
      <input className="input" maxLength={32} placeholder={t("Roll serial (optional)")} value={person.rollSerial} onChange={(e) => setPerson({ ...person, rollSerial: e.target.value })}/>
      <input className="input" maxLength={20} placeholder={t("Voter ID (optional)")} value={person.voterId} onChange={(e) => setPerson({ ...person, voterId: e.target.value })}/>
      <input className="input" type="number" min="0" max="130" placeholder={t("Age (optional)")} value={person.age} onChange={(e) => setPerson({ ...person, age: e.target.value })}/>
      <select className="input" value={person.gender} onChange={(e) => setPerson({ ...person, gender: e.target.value })} aria-label={t("Gender")}>{["MALE", "FEMALE", "OTHER", "UNKNOWN"].map((s) => <option key={s} value={s}>{t(s)}</option>)}</select>
      {addPerson.error && <ErrorBox error={addPerson.error}/>}
      <button className="btn w-full" disabled={addPerson.isPending}>{t("Add member")}</button>
    </form>}
    {(upd.error || del.error || archive.error) && <ErrorBox error={upd.error ?? del.error ?? archive.error}/>}
    <Async q={q}>{() => records.length ? <>{records.map((r) => tab === "citizens"
                ? <div key={r.id} className="card mb-2 text-sm"><div className="flex justify-between gap-2"><span className="font-medium">{r.fullName}</span><span className="text-xs text-slate-500">{r.boothCode} · {r.houseCode}</span></div>
          <p className="text-xs text-slate-500">{r.relation} · Voter {r.voterId ?? "—"} · {t("Roll serial")} {r.rollSerial ?? "—"} · {r.age ?? "—"} {t("years")} · {t(r.gender)}</p>
          {r.address && <p className="text-xs text-slate-500">{r.address}</p>}
          <div className="flex items-center justify-between gap-2"><p className="text-xs text-slate-500">{t("Life status")}: {t(r.lifeStatus)} · {t("Verification steps")}: {r.passedSteps}/6 {r.passedSteps >= 6 && <span className="ml-1 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">{t("Verified")}</span>}</p><button type="button" className="btn-ghost text-xs text-red-700" disabled={archive.isPending} onClick={() => confirm(`${t("Archive")} ${r.fullName}? ${t("Their verification history will be retained.")}`) && archive.mutate(r.id)}>{t("Remove from active roster")}</button></div>
          <select className="input mt-2" value={r.lifeStatus} aria-label={t("Life status")} onChange={(e) => upd.mutate({ id: r.id, lifeStatus: e.target.value })}>{["ALIVE", "DECEASED", "UNKNOWN"].map((s) => <option key={s} value={s}>{t(s)}</option>)}</select></div>
                : <div key={r.id} className="card mb-2 flex items-center justify-between gap-2 text-sm"><div><span>{r.boothCode} · {r.houseCode} · {r.members} {t("members")}</span>{r.address && <p className="text-xs text-slate-500">{r.address}</p>}</div><div className="flex items-center gap-2"><Badge s={r.status}/><button className="btn-ghost" onClick={() => confirm(`Delete house ${r.houseCode}? It will be hidden from all booth members.`) && del.mutate(r.id)}>{t("Delete")}</button></div></div>)}
      {q.hasNextPage && <button type="button" className="btn w-full" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>{t(q.isFetchingNextPage ? "Loading…" : "Show more records")}</button>}
    </> : <Empty text="No records found."/>}</Async></div>;
}
