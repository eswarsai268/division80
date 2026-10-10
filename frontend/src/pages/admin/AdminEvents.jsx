import { useState } from "react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import ErrorBox from "../../components/ErrorBox";
import Field from "../../components/Field";
import Title from "../../components/Title";
import { fmt } from "../../utils/format";
import { patch, post } from "../../api/client";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";

export default function AdminEvents() {
    const [f, setF] = useState({ kind: "EVENT", title: "", body: "", startsAt: "" });
    const q = useGet(["admin", "events"], "/admin/events");
    const create = useAct(() => post("/admin/events", { kind: f.kind, title: f.title, body: f.body, ...(f.startsAt ? { startsAt: new Date(f.startsAt).toISOString() } : {}) }).then(() => setF({ ...f, title: "", body: "", startsAt: "" })));
    const act = useAct((v) => post(`/admin/events/${v.id}/${v.a}`));
    const edit = useAct((v) => patch(`/admin/events/${v.id}`, { title: v.title }));
    return <div className="space-y-3"><Title>Events & announcements</Title>
    <div className="card space-y-2">
      <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} aria-label="Type"><option value="EVENT">Event</option><option value="ANNOUNCEMENT">Announcement</option></select>
      <input className="input" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="Title"/>
      <textarea className="input" placeholder="Details" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} aria-label="Details"/>
      {f.kind === "EVENT" && <Field label="Date & time"><input className="input" type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })}/></Field>}
      {(create.error || act.error || edit.error) && <ErrorBox error={create.error ?? act.error ?? edit.error}/>}
      <button className="btn w-full" disabled={create.isPending || f.title.length < 2 || f.body.length < 2} onClick={() => create.mutate(undefined)}>Save as draft</button></div>
    <Async q={q}>{(d) => d.length ? <>{d.map((e) => <div key={e.id} className="card mb-2 space-y-1 text-sm"><div className="flex justify-between"><span className="font-medium">{e.title} <span className="text-xs text-slate-400">({e.kind.toLowerCase()})</span></span><Badge s={e.status}/></div><p className="text-slate-600">{e.body}</p><p className="text-xs text-slate-400">{fmt(e.startsAt)}</p>
      {e.status !== "ARCHIVED" && <div className="flex gap-2">{e.status === "DRAFT" && <button className="btn flex-1" onClick={() => act.mutate({ id: e.id, a: "publish" })}>Publish</button>}<button className="btn-ghost flex-1" onClick={() => { const t = prompt("New title", e.title); if (t && t.length > 1)
                edit.mutate({ id: e.id, title: t }); }}>Edit title</button><button className="btn-ghost flex-1" onClick={() => confirm("Archive?") && act.mutate({ id: e.id, a: "archive" })}>Archive</button></div>}</div>)}</> : <Empty text="No events yet."/>}</Async></div>;
}
