import { useState } from "react";
import Async from "../../components/Async";
import Empty from "../../components/Empty";
import ErrorBox from "../../components/ErrorBox";
import Title from "../../components/Title";
import { api, post } from "../../api/client";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";

export default function AdminAssignments() {
    const [boothId, setBooth] = useState("");
    const [userId, setUserId] = useState("");
    const q = useGet(["admin", "assignments"], "/admin/assignments");
    const booths = useGet(["admin", "booths"], "/admin/booths");
    const users = useGet(["admin", "users", "BOOTH_MEMBER"], "/admin/users?role=BOOTH_MEMBER");
    const assign = useAct(() => post(`/admin/booths/${boothId}/assignments`, { userId, canApproveCrossBooth: false }).then(() => setUserId("")));
    const revoke = useAct((id) => api(`/admin/assignments/${id}`, { method: "DELETE" }));
    return <div className="space-y-3"><Title>{t("Booth assignments")}</Title>
    <div className="card space-y-2">
      <select className="input" value={boothId} onChange={(e) => setBooth(e.target.value)} aria-label={t("Booth")}><option value="">{t("Booth…")}</option>{booths.data?.filter((b) => b.status === "ACTIVE").map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select>
      <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)} aria-label={t("Member")}><option value="">{t("Member…")}</option>{users.data?.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select>
      {(assign.error || revoke.error) && <ErrorBox error={assign.error ?? revoke.error}/>}
      <button className="btn w-full" disabled={!boothId || !userId || assign.isPending} onClick={() => assign.mutate(undefined)}>{t("Assign")}</button></div>
    <Async q={q}>{(d) => d.length ? <>{d.map((a) => <div key={a.id} className="card mb-2 flex items-center justify-between text-sm"><span>{a.boothCode} · {a.fullName}{a.canApprove ? " · approver" : ""}</span><button className="btn-ghost" onClick={() => confirm("Revoke?") && revoke.mutate(a.id)}>{t("Revoke")}</button></div>)}</> : <Empty text="No active assignments."/>}</Async></div>;
}
