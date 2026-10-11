import { useParams } from "react-router-dom";
import { useState } from "react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import ErrorBox from "../../components/ErrorBox";
import AttachmentImage from "../../components/AttachmentImage";
import { NEXT_STATUS } from "../../utils/constants";
import { fmt } from "../../utils/format";
import { patch } from "../../api/client";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";

export default function AdminComplaintDetail() {
    const { id } = useParams();
    const [booth, setBooth] = useState("");
    const [note, setNote] = useState("");
    const q = useGet(["admin", "complaint", id], `/admin/complaints/${id}`);
    const att = useGet(["admin", "complaint", id, "att"], `/admin/complaints/${id}/attachments`);
    const booths = useGet(["admin", "booths"], "/admin/booths");
    const m = useAct((body) => patch(`/admin/complaints/${id}`, body));
    return <Async q={q}>{(c) => <div className="space-y-3">
    <div className="card"><div className="flex justify-between"><h1 className="font-semibold">{c.title}</h1><Badge s={c.status}/></div><p className="mt-1 text-xs text-slate-500">{c.category} · by {c.submittedBy} · {fmt(c.createdAt)}{c.location ? ` · ${c.location}` : ""}</p><p className="mt-2 text-sm text-slate-700">{c.description}</p></div>
    {att.data && att.data.length > 0 && <section className="card space-y-3" aria-label="Complaint photos"><h2 className="text-sm font-semibold">Photos</h2><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{att.data.map((a, index) => <AttachmentImage key={a.id} attachment={a} index={index} refresh={att.refetch}/>)}</div></section>}
    <div className="card space-y-2"><h2 className="font-semibold">Action</h2>
      <select className="input" value={booth} onChange={(e) => setBooth(e.target.value)} aria-label="Assign to booth"><option value="">{c.assignedBoothId ? "Booth assigned (change…)" : "Assign to booth…"}</option>{booths.data?.filter((b) => b.status === "ACTIVE").map((b) => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}</select>
      <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note"/>
      {m.error && <ErrorBox error={m.error}/>}
      <div className="flex gap-2">
        {NEXT_STATUS[c.status] && <button className="btn flex-1" disabled={m.isPending} onClick={() => m.mutate({ status: NEXT_STATUS[c.status], note: note || undefined, expectedVersion: c.version, ...(booth ? { assignedBoothId: booth } : {}) })}>Move to {NEXT_STATUS[c.status].replace(/_/g, " ")}</button>}
        {c.status === "RESOLVED" && <button className="btn-ghost flex-1" onClick={() => m.mutate({ status: "REOPENED", note: note || undefined, expectedVersion: c.version })}>Reopen</button>}
        {!["RESOLVED", "REJECTED"].includes(c.status) && <button className="btn-ghost flex-1" onClick={() => confirm("Reject this complaint?") && m.mutate({ status: "REJECTED", note: note || undefined, expectedVersion: c.version })}>Reject</button>}</div></div>
    <div className="card text-xs text-slate-500"><h2 className="mb-1 text-sm font-semibold text-slate-700">Timeline</h2>{c.timeline.map((e, i) => <p key={i}>{fmt(e.createdAt)} — {String(e.toStatus).replace(/_/g, " ")}{e.note ? `: ${e.note}` : ""}</p>)}</div>
  </div>}</Async>;
}
