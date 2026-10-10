import { useState } from "react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import ErrorBox from "../../components/ErrorBox";
import Title from "../../components/Title";
import { api, patch } from "../../api/client";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";

export default function AdminCitizens() {
    const [tab, setTab] = useState("citizens");
    const [search, setSearch] = useState("");
    const [boothId, setBooth] = useState("");
    const qs = `?limit=50${search ? `&search=${encodeURIComponent(search)}` : ""}${boothId ? `&boothId=${boothId}` : ""}`;
    const q = useGet(["admin", tab, search, boothId], `/admin/${tab}${qs}`);
    const booths = useGet(["admin", "booths"], "/admin/booths");
    const upd = useAct((v) => patch(`/admin/citizens/${v.id}`, { lifeStatus: v.lifeStatus }));
    const del = useAct((id) => api(`/admin/households/${id}`, { method: "DELETE" }));
    return <div className="space-y-3"><Title>Citizens & households</Title>
    <div className="flex gap-2">{["citizens", "households"].map((t) => <button key={t} onClick={() => setTab(t)} className={`btn-ghost flex-1 ${tab === t ? "!bg-brand-600 !text-white" : ""}`}>{t === "citizens" ? "Citizens" : "Households"}</button>)}</div>
    <input className="input" placeholder={tab === "citizens" ? "Search by name" : "Search house e.g. G-24"} value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search"/>
    <select className="input" value={boothId} onChange={(e) => setBooth(e.target.value)} aria-label="Booth filter"><option value="">All booths</option>{booths.data?.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select>
    {(upd.error || del.error) && <ErrorBox error={upd.error ?? del.error}/>}
    <Async q={q}>{(d) => d.items.length ? <>{d.items.map((r) => tab === "citizens"
                ? <div key={r.id} className="card mb-2 text-sm"><div className="flex justify-between"><span className="font-medium">{r.fullName}</span><span className="text-xs text-slate-500">{r.boothCode} · {r.houseCode}</span></div>
          <p className="text-xs text-slate-500">{r.relation} · Voter {r.voterId ?? "—"} · verified {r.passedSteps}/6</p>
          <select className="input mt-2" value={r.lifeStatus} aria-label="Life status" onChange={(e) => upd.mutate({ id: r.id, lifeStatus: e.target.value })}>{["ALIVE", "DECEASED", "UNKNOWN"].map((s) => <option key={s}>{s}</option>)}</select></div>
                : <div key={r.id} className="card mb-2 flex items-center justify-between text-sm"><span>{r.boothCode} · {r.houseCode} · {r.members} members</span><div className="flex items-center gap-2"><Badge s={r.status}/><button className="btn-ghost" onClick={() => confirm(`Delete house ${r.houseCode}? It will be hidden from all booth members.`) && del.mutate(r.id)}>Delete</button></div></div>)}</> : <Empty text="No records found."/>}</Async></div>;
}
