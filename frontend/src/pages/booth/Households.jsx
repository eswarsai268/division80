import { Link } from "react-router-dom";
import { useState } from "react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import Title from "../../components/Title";
import { useGet } from "../../hooks/useGet";

export default function Households() {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const q = useGet(["booth", "households", search, status], `/booth/households?limit=50${search ? `&search=${encodeURIComponent(search)}` : ""}${status ? `&status=${status}` : ""}`);
    return <div className="space-y-3"><Title>Households</Title>
    <input className="input" placeholder="Search house e.g. G-24" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search houses"/>
    <div className="flex gap-2 overflow-x-auto">{[["", "ALL"], ["PENDING", "PENDING"], ["IN_VERIFICATION", "IN VERIFICATION"], ["RESOLVED", "RESOLVED"]].map(([s, l]) => <button key={s} onClick={() => setStatus(s)} className={`btn-ghost whitespace-nowrap ${status === s ? "!bg-brand-600 !text-white" : ""}`}>{l}</button>)}</div>
    <Async q={q}>{(d) => d.items.length ? <>{d.items.map((h) => <Link key={h.id} to={`/booth/households/${h.id}`} className="card mb-2 flex items-center justify-between"><span className="font-medium">House {h.houseCode}</span><Badge s={h.status}/></Link>)}</> : <Empty text="No houses found."/>}</Async></div>;
}
/** Used for both /booth/households/:id and /booth/households/:id/citizens. */
