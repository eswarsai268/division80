import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import ErrorBox from "../../components/ErrorBox";
import { STEPS } from "../../utils/constants";
import { post } from "../../api/client";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";

export default function HouseholdDetail() {
    const { id } = useParams();
    const qc = useQueryClient();
    const q = useGet(["booth", "household", id], `/booth/households/${id}/citizens`);
    const m = useMutation({
        mutationFn: (v) => post("/booth/verifications", v, { "Idempotency-Key": crypto.randomUUID() }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["booth"] }),
    });
    return <Async q={q}>{({ household, citizens }) => <div className="space-y-3">
    <div className="card flex items-center justify-between"><h1 className="font-semibold">{t("House")} {household.houseCode}</h1><Badge s={household.status}/></div>
    {household.address && <p className="text-sm text-slate-600">{household.address}</p>}
    {!household.ownBooth && <div className="card bg-amber-50 text-sm text-amber-900">{t("Read-only access granted through a cross-booth approval.")}</div>}
    {m.error && <ErrorBox error={m.error}/>}
    {citizens.length === 0 && <Empty text="No family members on record."/>}
    {citizens.map((c) => <div key={c.id} className="card space-y-2">
      <div><p className="font-medium">{c.fullName}</p><p className="text-xs text-slate-500">{c.relation} · Voter {c.voterId ?? "—"} · {t("Roll serial")} {c.rollSerial ?? "—"} · {c.age ?? "—"} {t("years")} · {t(c.gender)} · {t(c.lifeStatus)}</p></div>
      <ol className="space-y-1">{STEPS.map((s, i) => <li key={s} className="flex items-center justify-between text-sm"><span>{i + 1}. {t(s)}</span><Badge s={i < c.passedSteps ? "PASSED" : "PENDING"}/></li>)}</ol>
      {household.ownBooth && c.passedSteps < 6 && <div className="flex gap-2">
        <button className="btn flex-1" disabled={m.isPending} onClick={() => m.mutate({ citizenId: c.id, step: c.passedSteps + 1, result: "PASSED" })}>{t("Pass step")} {c.passedSteps + 1}</button>
        <button className="btn-ghost flex-1" disabled={m.isPending} onClick={() => confirm("Record this step as FAILED?") && m.mutate({ citizenId: c.id, step: c.passedSteps + 1, result: "FAILED" })}>{t("Fail")}</button></div>}
    </div>)}
    <p className="text-xs text-slate-400">{t("The server decides the real verification state; this screen only reflects it.")}</p>
  </div>}</Async>;
}
