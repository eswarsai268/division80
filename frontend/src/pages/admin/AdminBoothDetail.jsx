import { useParams } from "react-router-dom";
import { useState } from "react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import ErrorBox from "../../components/ErrorBox";
import { api, patch, post } from "../../api/client";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";

export default function AdminBoothDetail() {
    const { boothId } = useParams();
    const [userId, setUserId] = useState("");
    const [approver, setApprover] = useState(false);
    const [name, setName] = useState("");
    const b = useGet(["admin", "booth", boothId], `/admin/booths/${boothId}`);
    const asg = useGet(["admin", "booth", boothId, "asg"], `/admin/booths/${boothId}/assignments`);
    const users = useGet(["admin", "users", "BOOTH_MEMBER"], "/admin/users?role=BOOTH_MEMBER");
    const assign = useAct(() => post(`/admin/booths/${boothId}/assignments`, { userId, canApproveCrossBooth: approver }).then(() => setUserId("")));
    const revoke = useAct((id) => api(`/admin/assignments/${id}`, { method: "DELETE" }));
    const upd = useAct((body) => patch(`/admin/booths/${boothId}`, body));
    return <div className="space-y-3"><Async q={b}>{(d) => <>
    <div className="card space-y-2"><div className="flex justify-between"><h1 className="font-semibold">{d.code} — {d.name}</h1><Badge s={d.status}/></div><p className="text-sm text-slate-600">{d.households} households</p>
      <div className="flex gap-2"><input className="input" placeholder="Rename booth" value={name} onChange={(e) => setName(e.target.value)} aria-label="New booth name"/><button className="btn-ghost" disabled={name.length < 2} onClick={() => upd.mutate({ name })}>Rename</button></div>
      <button className="btn-ghost w-full" onClick={() => confirm(d.status === "ACTIVE" ? "Deactivate this booth? Members lose access immediately." : "Activate booth?") && upd.mutate({ status: d.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}>{d.status === "ACTIVE" ? "Deactivate booth" : "Activate booth"}</button></div></>}</Async>
    <div className="card space-y-2"><h2 className="font-semibold">Assign booth member</h2>
      <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="Member"><option value="">Select member…</option>{users.data?.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>)}</select>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={approver} onChange={(e) => setApprover(e.target.checked)}/> Can approve cross-booth requests</label>
      {(assign.error || upd.error || revoke.error) && <ErrorBox error={assign.error ?? upd.error ?? revoke.error}/>}
      <button className="btn w-full" disabled={!userId || assign.isPending} onClick={() => assign.mutate(undefined)}>Assign</button></div>
    <Async q={asg}>{(d) => d.length ? <>{d.map((a) => <div key={a.id} className="card mb-2 flex items-center justify-between text-sm"><span>{a.fullName}{a.canApprove ? " · approver" : ""}</span><button className="btn-ghost" onClick={() => confirm("Revoke this assignment?") && revoke.mutate(a.id)}>Revoke</button></div>)}</> : <Empty text="No members assigned."/>}</Async></div>;
}
