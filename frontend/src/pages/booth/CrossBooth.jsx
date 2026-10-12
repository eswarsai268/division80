import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import ErrorBox from "../../components/ErrorBox";
import Title from "../../components/Title";
import { fmt } from "../../utils/format";
import { post } from "../../api/client";
import { useGet } from "../../hooks/useGet";
import { useMe } from "../../auth/useMe";
import { STEPS } from "../../utils/constants";
import { t } from "../../i18n";

function GrantedRoster({ request, canVerify, onChange }) {
    const query = useGet(["booth", "cross-household", request.id], `/cross-booth/requests/${request.id}/household`);
    const verify = useMutation({
        mutationFn: (value) => post("/booth/verifications", value, { "Idempotency-Key": crypto.randomUUID() }),
        onSuccess: onChange,
    });
    return <Async q={query}>{({ household, citizens, action }) => <div className="mt-3 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
      <p className="text-sm font-semibold text-emerald-900">{household.boothCode} · House {household.houseCode} · {action === "VERIFY" ? "Verification access" : "Read-only access"}</p>
      {citizens.map((citizen) => <div key={citizen.id} className="rounded-lg bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{citizen.fullName}</span><span className="text-xs text-slate-500">{citizen.relation} · Voter ID {citizen.voterId ?? "—"}</span></div>
        <p className="mt-1 text-xs text-slate-500">{citizen.lifeStatus} · {citizen.passedSteps}/6 steps complete</p>
        {canVerify && action === "VERIFY" && citizen.passedSteps < STEPS.length && <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 text-xs text-slate-600">Next: {STEPS[citizen.passedSteps]}</span>
          <button className="btn" disabled={verify.isPending} onClick={() => verify.mutate({ citizenId: citizen.id, step: citizen.passedSteps + 1, result: "PASSED" })}>{t("Pass step")}</button>
          <button className="btn-ghost" disabled={verify.isPending} onClick={() => confirm("Record the current verification step as failed?") && verify.mutate({ citizenId: citizen.id, step: citizen.passedSteps + 1, result: "FAILED" })}>{t("Fail")}</button>
        </div>}
      </div>)}
      {verify.error && <ErrorBox error={verify.error}/>}
      {action === "VERIFY" && <p className="text-xs text-emerald-900">{t("Verification is recorded against this temporary grant and is visible in the admin cross-booth report.")}</p>}
    </div>}</Async>;
}

export default function CrossBooth() {
    const { data: me } = useMe();
    const qc = useQueryClient();
    const list = useGet(["booth", "cross"], "/cross-booth/requests");
    const [voterId, setVoterId] = useState("");
    const [reason, setReason] = useState("");
    const [source, setSource] = useState("");
    const create = useMutation({
        mutationFn: () => post("/cross-booth/requests", { sourceBoothId: source || me.boothIds[0], voterId: voterId.trim(), action: "VERIFY", reason }),
        onSuccess: () => { setVoterId(""); setReason(""); qc.invalidateQueries({ queryKey: ["booth", "cross"] }); },
    });
    const decide = useMutation({
        mutationFn: (v) => post(`/cross-booth/requests/${v.id}/${v.d}`, v.d === "approve" ? { grantHours: 4 } : {}),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["booth", "cross"] }),
    });
    const refresh = () => {
        qc.invalidateQueries({ queryKey: ["booth", "cross"] });
        qc.invalidateQueries({ queryKey: ["booth", "cross-household"] });
        qc.invalidateQueries({ queryKey: ["booth", "verifications"] });
    };
    return <div className="space-y-4"><Title>{t("Cross-booth coordination")}</Title>
    <div className="card space-y-3">
      <div><h2 className="font-semibold">{t("Request voter verification")}</h2><p className="mt-1 text-sm text-slate-600">{t("Enter the exact voter ID from your booth visit. The target booth must approve before member details or verification steps are accessible.")}</p></div>
      {(me?.boothIds.length ?? 0) > 1 && <select className="input" value={source} onChange={(e) => setSource(e.target.value)} aria-label={t("Source booth")}><option value="">{t("Select your booth…")}</option>{me.boothIds.map((b) => <option key={b} value={b}>{b.slice(0, 8)}</option>)}</select>}
      <label className="label" htmlFor="cross-voter-id">{t("Voter ID")}</label>
      <input id="cross-voter-id" className="input" placeholder={t("Enter voter ID")} autoCapitalize="characters" value={voterId} onChange={(e) => setVoterId(e.target.value.toUpperCase())} aria-label={t("Voter ID")}/>
      <label className="label" htmlFor="cross-reason">{t("Why is cross-booth verification needed?")}</label>
      <textarea id="cross-reason" className="input min-h-20" placeholder={t("Add a short reason for the target booth approver")} value={reason} onChange={(e) => setReason(e.target.value)} aria-label={t("Reason")}/>
      {create.error && <ErrorBox error={create.error}/>}
      <button className="btn w-full" disabled={create.isPending || voterId.trim().length < 6 || reason.trim().length < 5 || (me?.boothIds.length ?? 0) === 0}>{create.isPending ? "Sending request…" : "Request verification approval"}</button>
    </div>
    {decide.error && <ErrorBox error={decide.error}/>}
    <section><h2 className="mb-2 font-semibold text-brand-900">{t("Requests and approvals")}</h2>
    <Async q={list}>{(requests) => requests.length ? <>{requests.map((r) => {
      const activeGrant = r.mine && r.status === "APPROVED" && r.grantExpiresAt && new Date(r.grantExpiresAt).getTime() > Date.now();
      return <article key={r.id} className="card mb-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{r.sourceBoothCode} → {r.targetBoothCode} · House {r.houseCode}</span><Badge s={r.status}/></div>
        <p className="text-sm text-slate-600">{r.mine ? "Your request" : `From ${r.requesterName}`} · {r.action === "VERIFY" ? "Verification access" : "Read only"}</p>
        <p className="text-sm text-slate-600">{r.reason}</p>
        <p className="text-xs text-slate-500">{r.grantExpiresAt ? "Access until" : "Request expires"} {fmt(r.grantExpiresAt ?? r.expiresAt)}</p>
        {r.canDecide && <div className="flex gap-2"><button className="btn flex-1" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, d: "approve" })}>{t("Approve · 4 hours")}</button><button className="btn-ghost flex-1" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, d: "reject" })}>{t("Reject")}</button></div>}
        {activeGrant && <GrantedRoster request={r} canVerify onChange={refresh}/>}
      </article>;
    })}</> : <Empty text="No cross-booth requests yet."/>}</Async></section></div>;
}
