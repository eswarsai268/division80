import { useState } from "react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import ErrorBox from "../../components/ErrorBox";
import Title from "../../components/Title";
import { download, post } from "../../api/client";
import { fmt } from "../../utils/format";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";

export default function AdminExports() {
    const [kind, setKind] = useState("CITIZENS");
    const [boothId, setBooth] = useState("");
    const jobs = useGet(["admin", "exports"], "/admin/export-jobs", { refetchInterval: 4000 });
    const booths = useGet(["admin", "booths"], "/admin/booths");
    const create = useAct(() => post("/admin/export-jobs", { kind, ...(boothId ? { boothId } : {}) }));
    const [dlErr, setDlErr] = useState(null);
    return <div className="space-y-3"><Title>Data exports</Title>
    <div className="card space-y-2"><p className="text-xs text-slate-500">Exports are generated in the background, voter IDs are masked, files expire after 24 hours, and every export/download is audited.</p>
      <select className="input" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Export type"><option value="CITIZENS">Citizens</option><option value="HOUSEHOLDS">Households</option><option value="COMPLAINTS">Complaints</option></select>
      <select className="input" value={boothId} onChange={(e) => setBooth(e.target.value)} aria-label="Booth scope"><option value="">Whole organisation</option>{booths.data?.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select>
      {create.error && <ErrorBox error={create.error}/>}<button className="btn w-full" disabled={create.isPending} onClick={() => confirm("Create this export? It will be recorded in the audit log.") && create.mutate(undefined)}>Request export</button></div>
    {dlErr ? <ErrorBox error={dlErr}/> : null}
    <Async q={jobs}>{(d) => d.length ? <>{d.map((j) => <div key={j.id} className="card mb-2 flex items-center justify-between text-sm"><div><p className="font-medium">{j.kind}</p><p className="text-xs text-slate-500">{fmt(j.createdAt)} · {j.rowCount} rows{j.lastError ? ` · ${j.lastError}` : ""}</p></div>
      <div className="flex items-center gap-2"><Badge s={j.status}/>{j.status === "READY" && <button className="btn" onClick={() => download(`/admin/export-jobs/${j.id}/download`, `export-${j.kind.toLowerCase()}.csv`).catch(setDlErr)}>Download</button>}</div></div>)}</> : <Empty text="No exports yet."/>}</Async></div>;
}
