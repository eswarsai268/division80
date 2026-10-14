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
    const [boothIds, setBoothIds] = useState([]);
    const [userId, setUserId] = useState("");
    const q = useGet(["admin", "assignments"], "/admin/assignments");
    const booths = useGet(["admin", "booths"], "/admin/booths");
    const users = useGet(["admin", "users", "BOOTH_MEMBER"], "/admin/users?role=BOOTH_MEMBER");
    const assign = useAct(async () => {
        try {
            for (const boothId of boothIds)
                await post(`/admin/booths/${boothId}/assignments`, { userId, canApproveCrossBooth: false });
        } catch (error) {
            await Promise.all([q.refetch(), booths.refetch()]);
            throw error;
        }
        setBoothIds([]);
        setUserId("");
    });
    const revoke = useAct((id) => api(`/admin/assignments/${id}`, { method: "DELETE" }));
    const activeBooths = booths.data?.filter((b) => b.status === "ACTIVE") ?? [];
    const alreadyAssigned = new Set((q.data ?? []).filter((a) => a.userId === userId).map((a) => a.boothId));
    const unassignedBooths = activeBooths.filter((b) => !alreadyAssigned.has(b.id));
    const toggleBooth = (id) => setBoothIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    return <div className="space-y-3"><Title>{t("Booth assignments")}</Title>
    <div className="card space-y-2">
      <select className="input" value={userId} onChange={(event) => { setUserId(event.target.value); setBoothIds([]); }} aria-label={t("Member")}>
        <option value="">{t("Member…")}</option>{users.data?.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
      </select>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-2 text-sm font-medium">Select booths for this member</p>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {activeBooths.map((booth) => <label key={booth.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${alreadyAssigned.has(booth.id) ? "text-slate-400" : "text-slate-800"}`}>
            <input type="checkbox" checked={boothIds.includes(booth.id)} disabled={!userId || alreadyAssigned.has(booth.id)} onChange={() => toggleBooth(booth.id)}/>
            <span>{booth.code}{alreadyAssigned.has(booth.id) ? " · already assigned" : ""}</span>
          </label>)}
          {activeBooths.length === 0 && <p className="text-sm text-slate-500">No active booths. Import booth codes or create booths first.</p>}
        </div>
        {unassignedBooths.length > 1 && <button type="button" className="btn-ghost mt-2" disabled={!userId} onClick={() => setBoothIds(unassignedBooths.map((booth) => booth.id))}>Select all unassigned booths</button>}
      </div>
      {(assign.error || revoke.error) && <ErrorBox error={assign.error ?? revoke.error}/>}
      <button className="btn w-full" disabled={!boothIds.length || !userId || assign.isPending} onClick={() => assign.mutate(undefined)}>{assign.isPending ? "Assigning booths…" : `Assign ${boothIds.length || "selected"} booth${boothIds.length === 1 ? "" : "s"}`}</button>
    </div>
    <Async q={q}>{(data) => data.length ? <>{data.map((assignment) => <div key={assignment.id} className="card mb-2 flex items-center justify-between text-sm"><span>{assignment.boothCode} · {assignment.fullName}{assignment.canApprove ? " · approver" : ""}</span><button className="btn-ghost" onClick={() => confirm("Revoke this assignment?") && revoke.mutate(assignment.id)}>{t("Revoke")}</button></div>)}</> : <Empty text="No active assignments."/>}</Async></div>;
}
