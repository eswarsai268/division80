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
import { t } from "../../i18n";
import { isValidPhone, normalizePhone } from "../../utils/phone";

export default function AdminBooths() {
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [member, setMember] = useState({ fullName: "", phone: "", password: "" });
    const [createdMemberPhone, setCreatedMemberPhone] = useState("");
    const q = useGet(["admin", "booths"], "/admin/booths");
    const memberFields = [member.fullName, member.phone, member.password];
    const memberStarted = memberFields.some(Boolean);
    const memberComplete = member.fullName.trim().length >= 2 && isValidPhone(member.phone) && member.password.length >= 4;
    const m = useAct(() => post("/admin/booths", {
        code: code.trim(),
        name: name.trim(),
        ...(memberStarted ? { member: { ...member, fullName: member.fullName.trim(), phone: normalizePhone(member.phone) } } : {}),
    }).then((result) => {
        setCreatedMemberPhone(result.memberId ? normalizePhone(member.phone) : "");
        setCode("");
        setName("");
        setMember({ fullName: "", phone: "", password: "" });
        return result;
    }));
    const invalidPartialMember = memberStarted && !memberComplete;
    return <div className="space-y-3"><Title>{t("Booths")}</Title>
    <div className="card space-y-2"><h2 className="font-semibold">{t("Create booth")}</h2>
      <input className="input" placeholder={t("Code (e.g. B-12)")} value={code} onChange={(e) => setCode(e.target.value)} aria-label={t("Booth code")}/><input className="input" placeholder={t("Name")} value={name} onChange={(e) => setName(e.target.value)} aria-label={t("Booth name")}/>
      <div className="mt-3 space-y-2 border-t border-brand-100 pt-3">
        <div><h3 className="text-sm font-semibold">{t("First booth member login (optional)")}</h3><p className="mt-1 text-xs text-slate-500">{t("Create and assign the member now. They can sign in at Booth login with this phone number and password.")}</p></div>
        <input className="input" placeholder={t("Member full name")} value={member.fullName} onChange={(e) => setMember({ ...member, fullName: e.target.value })} aria-label={t("Booth member full name")}/>
        <input className="input" type="tel" autoComplete="tel" placeholder={t("Member phone number")} value={member.phone} onChange={(e) => setMember({ ...member, phone: e.target.value })} aria-label={t("Booth member phone number")}/>
        <input className="input" type="password" autoComplete="new-password" minLength={4} placeholder={t("Initial password (4+ characters)")} value={member.password} onChange={(e) => setMember({ ...member, password: e.target.value })} aria-label={t("Booth member initial password")}/>
        {invalidPartialMember && <p className="text-xs text-amber-800">{t("To create a member login, provide a name, valid phone number, and password of at least 4 characters.")}</p>}
      </div>
      {m.error && <ErrorBox error={m.error}/>}
      {m.isSuccess && <p role="status" className="text-sm text-emerald-700">{createdMemberPhone ? `Booth created. ${createdMemberPhone} is assigned and can sign in at Booth login.` : "Booth created."}</p>}
      <button className="btn w-full" disabled={!code.trim() || name.trim().length < 2 || invalidPartialMember || m.isPending} onClick={() => m.mutate(undefined)}>{m.isPending ? "Creating…" : memberStarted ? "Create booth and login" : "Create booth"}</button></div>
    <Async q={q}>{(d) => d.length ? <>{d.map((b) => <Link key={b.id} to={`/admin/booths/${b.id}`} className="card mb-2 flex justify-between"><span>{b.code} — {b.name}</span><Badge s={b.status}/></Link>)}</> : <Empty text="No booths yet."/>}</Async></div>;
}
