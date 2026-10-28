import { useParams } from "react-router-dom";
import { useState } from "react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import ErrorBox from "../../components/ErrorBox";
import { api, patch, post } from "../../api/client";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";
import { isValidPhone, normalizePhone } from "../../utils/phone";

export default function AdminBoothDetail() {
    const { boothId } = useParams();
    const [userId, setUserId] = useState("");
    const [name, setName] = useState("");
    const [member, setMember] = useState({ fullName: "", phone: "", password: "" });
    const [createdMemberPhone, setCreatedMemberPhone] = useState("");
    const b = useGet(["admin", "booth", boothId], `/admin/booths/${boothId}`);
    const asg = useGet(["admin", "booth", boothId, "asg"], `/admin/booths/${boothId}/assignments`);
    const users = useGet(["admin", "users", "BOOTH_MEMBER"], "/admin/users?role=BOOTH_MEMBER");
    const assign = useAct(() => post(`/admin/booths/${boothId}/assignments`, { userId }).then(() => setUserId("")));
    const createMember = useAct(() => post("/admin/users", { ...member, phone: normalizePhone(member.phone), role: "BOOTH_MEMBER", boothId }).then((result) => {
        setCreatedMemberPhone(normalizePhone(member.phone));
        setMember({ fullName: "", phone: "", password: "" });
        return result;
    }));
    const revoke = useAct((id) => api(`/admin/assignments/${id}`, { method: "DELETE" }));
    const upd = useAct((body) => patch(`/admin/booths/${boothId}`, body));
    return <div className="space-y-3"><Async q={b}>{(d) => <>
    <div className="card space-y-2"><div className="flex justify-between"><h1 className="font-semibold">{d.code} — {d.name}</h1><Badge s={d.status}/></div><p className="text-sm text-slate-600">{d.households} households</p>
      <div className="flex gap-2"><input className="input" placeholder={t("Rename booth")} value={name} onChange={(e) => setName(e.target.value)} aria-label={t("New booth name")}/><button className="btn-ghost" disabled={name.length < 2} onClick={() => upd.mutate({ name })}>{t("Rename")}</button></div>
      <button className="btn-ghost w-full" onClick={() => confirm(d.status === "ACTIVE" ? "Deactivate this booth? Members lose access immediately." : "Activate booth?") && upd.mutate({ status: d.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}>{d.status === "ACTIVE" ? "Deactivate booth" : "Activate booth"}</button></div></>}</Async>
    <div className="card space-y-2"><h2 className="font-semibold">{t("Assign booth member")}</h2>
      <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)} aria-label={t("Member")}><option value="">{t("Select member…")}</option>{users.data?.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.phone || u.email || "no phone"})</option>)}</select>
      {(assign.error || upd.error || revoke.error) && <ErrorBox error={assign.error ?? upd.error ?? revoke.error}/>}
      <button className="btn w-full" disabled={!userId || assign.isPending} onClick={() => assign.mutate(undefined)}>{t("Assign")}</button></div>
    <div className="card space-y-2"><h2 className="font-semibold">{t("Create login for this booth")}</h2>
      <p className="text-xs text-slate-500">{t("The new account will be assigned to this booth immediately. Share the initial password securely with the member.")}</p>
      <input className="input" placeholder={t("Member full name")} value={member.fullName} onChange={(e) => setMember({ ...member, fullName: e.target.value })} aria-label={t("New member full name")}/>
      <input className="input" type="tel" autoComplete="tel" placeholder={t("Member phone number")} value={member.phone} onChange={(e) => setMember({ ...member, phone: e.target.value })} aria-label={t("New member phone number")}/>
      <input className="input" type="password" autoComplete="new-password" minLength={4} placeholder={t("Initial password (4+ characters)")} value={member.password} onChange={(e) => setMember({ ...member, password: e.target.value })} aria-label={t("New member initial password")}/>
      {createMember.error && <ErrorBox error={createMember.error}/>}
      {createMember.isSuccess && <p role="status" className="text-sm text-emerald-700">{t("Account")} {createdMemberPhone} {t("created and assigned. Sign in at Booth login.")}</p>}
      <button className="btn w-full" disabled={createMember.isPending || member.fullName.trim().length < 2 || !isValidPhone(member.phone) || member.password.length < 4} onClick={() => createMember.mutate(undefined)}>{createMember.isPending ? "Creating…" : "Create and assign login"}</button></div>
    <Async q={asg}>{(d) => d.length ? <>{d.map((a) => <div key={a.id} className="card mb-2 flex items-center justify-between text-sm"><span>{a.fullName}</span><button className="btn-ghost" onClick={() => confirm("Revoke this assignment?") && revoke.mutate(a.id)}>{t("Revoke")}</button></div>)}</> : <Empty text="No members assigned."/>}</Async></div>;
}
