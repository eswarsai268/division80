import { Link } from "react-router-dom";
import { useState } from "react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import ErrorBox from "../../components/ErrorBox";
import Title from "../../components/Title";
import { post } from "../../api/client";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";

export default function AdminBooths() {
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [member, setMember] = useState({ fullName: "", email: "", password: "", canApproveCrossBooth: false });
    const [createdMemberEmail, setCreatedMemberEmail] = useState("");
    const q = useGet(["admin", "booths"], "/admin/booths");
    const memberFields = [member.fullName, member.email, member.password];
    const memberStarted = memberFields.some(Boolean);
    const memberComplete = member.fullName.trim().length >= 2 && member.email.includes("@") && member.password.length >= 12;
    const m = useAct(() => post("/admin/booths", {
        code: code.trim(),
        name: name.trim(),
        ...(memberStarted ? { member: { ...member, fullName: member.fullName.trim(), email: member.email.trim() } } : {}),
    }).then((result) => {
        setCreatedMemberEmail(result.memberId ? member.email.trim() : "");
        setCode("");
        setName("");
        setMember({ fullName: "", email: "", password: "", canApproveCrossBooth: false });
        return result;
    }));
    const invalidPartialMember = memberStarted && !memberComplete;
    return <div className="space-y-3"><Title>Booths</Title>
    <div className="card space-y-2"><h2 className="font-semibold">Create booth</h2>
      <input className="input" placeholder="Code (e.g. B-12)" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Booth code"/><input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Booth name"/>
      <div className="mt-3 space-y-2 border-t border-brand-100 pt-3">
        <div><h3 className="text-sm font-semibold">First booth member login (optional)</h3><p className="mt-1 text-xs text-slate-500">Create and assign the member now. They can sign in at Booth login with this email and password.</p></div>
        <input className="input" placeholder="Member full name" value={member.fullName} onChange={(e) => setMember({ ...member, fullName: e.target.value })} aria-label="Booth member full name"/>
        <input className="input" type="email" autoComplete="off" placeholder="Member login email" value={member.email} onChange={(e) => setMember({ ...member, email: e.target.value })} aria-label="Booth member login email"/>
        <input className="input" type="password" autoComplete="new-password" minLength={12} placeholder="Initial password (at least 12 characters)" value={member.password} onChange={(e) => setMember({ ...member, password: e.target.value })} aria-label="Booth member initial password"/>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={member.canApproveCrossBooth} onChange={(e) => setMember({ ...member, canApproveCrossBooth: e.target.checked })}/> Can approve cross-booth requests</label>
        {invalidPartialMember && <p className="text-xs text-amber-800">To create a member login, provide a name, valid email, and password of at least 12 characters.</p>}
      </div>
      {m.error && <ErrorBox error={m.error}/>}
      {m.isSuccess && <p role="status" className="text-sm text-emerald-700">{createdMemberEmail ? `Booth created. ${createdMemberEmail} is assigned and can sign in at Booth login.` : "Booth created."}</p>}
      <button className="btn w-full" disabled={!code.trim() || name.trim().length < 2 || invalidPartialMember || m.isPending} onClick={() => m.mutate(undefined)}>{m.isPending ? "Creating…" : memberStarted ? "Create booth and login" : "Create booth"}</button></div>
    <Async q={q}>{(d) => d.length ? <>{d.map((b) => <Link key={b.id} to={`/admin/booths/${b.id}`} className="card mb-2 flex justify-between"><span>{b.code} — {b.name}</span><Badge s={b.status}/></Link>)}</> : <Empty text="No booths yet."/>}</Async></div>;
}
