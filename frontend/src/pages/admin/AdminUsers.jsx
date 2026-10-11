import { useState } from "react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import ErrorBox from "../../components/ErrorBox";
import Title from "../../components/Title";
import { patch, post } from "../../api/client";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";

export default function AdminUsers() {
    const [f, setF] = useState({ email: "", fullName: "", password: "", role: "BOOTH_MEMBER", boothId: "", canApproveCrossBooth: false });
    const [createdEmail, setCreatedEmail] = useState("");
    const q = useGet(["admin", "users"], "/admin/users");
    const booths = useGet(["admin", "booths"], "/admin/booths");
    const create = useAct(() => post("/admin/users", {
        email: f.email.trim(),
        fullName: f.fullName.trim(),
        password: f.password,
        role: f.role,
        ...(f.role === "BOOTH_MEMBER" ? { boothId: f.boothId, canApproveCrossBooth: f.canApproveCrossBooth } : {}),
    }).then((result) => {
        setCreatedEmail(f.email.trim());
        setF({ ...f, email: "", fullName: "", password: "", boothId: "", canApproveCrossBooth: false });
        return result;
    }));
    const upd = useAct((v) => patch(`/admin/users/${v.id}`, { status: v.status }));
    return <div className="space-y-3"><Title>Users</Title>
    <div className="card space-y-2"><h2 className="font-semibold">Create booth member / user</h2>
      <input className="input" placeholder="Full name" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} aria-label="Full name"/>
      <input className="input" type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-label="Email"/>
      <input className="input" type="password" placeholder="Initial password (12+ chars)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} aria-label="Initial password" autoComplete="new-password"/>
      <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value, boothId: "" })} aria-label="Role"><option value="BOOTH_MEMBER">Booth member</option><option value="USER">Citizen</option></select>
      {f.role === "BOOTH_MEMBER" && <>
        <select className="input" value={f.boothId} onChange={(e) => setF({ ...f, boothId: e.target.value })} aria-label="Assign member to booth"><option value="">Select booth (required)</option>{booths.data?.filter((b) => b.status === "ACTIVE").map((b) => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}</select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.canApproveCrossBooth} onChange={(e) => setF({ ...f, canApproveCrossBooth: e.target.checked })}/> Can approve cross-booth requests</label>
      </>}
      {(create.error || upd.error) && <ErrorBox error={create.error ?? upd.error}/>}
      {create.isSuccess && <p role="status" className="text-sm text-emerald-700">{f.role === "BOOTH_MEMBER" ? `Member ${createdEmail} created and assigned. They can sign in at Booth login.` : `Citizen account ${createdEmail} created.`}</p>}
      <button className="btn w-full" disabled={create.isPending || f.password.length < 12 || !f.email.includes("@") || f.fullName.trim().length < 2 || (f.role === "BOOTH_MEMBER" && !f.boothId)} onClick={() => create.mutate(undefined)}>{create.isPending ? "Creating…" : f.role === "BOOTH_MEMBER" ? "Create and assign booth login" : "Create citizen"}</button></div>
    <Async q={q}>{(d) => <>{d.map((u) => <div key={u.id} className="card mb-2 flex items-center justify-between text-sm"><div><p className="font-medium">{u.fullName}</p><p className="text-xs text-slate-500">{u.email} · {String(u.role).replace("_", " ")}</p></div>
      <div className="flex items-center gap-2"><Badge s={u.status}/>{u.role !== "ADMIN" && <button className="btn-ghost" onClick={() => confirm(u.status === "ACTIVE" ? "Suspend this account?" : "Reactivate?") && upd.mutate({ id: u.id, status: u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })}>{u.status === "ACTIVE" ? "Suspend" : "Activate"}</button>}</div></div>)}</>}</Async></div>;
}
