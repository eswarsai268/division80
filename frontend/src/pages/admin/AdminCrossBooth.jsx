import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import Title from "../../components/Title";
import { fmt } from "../../utils/format";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";

export default function AdminCrossBooth() {
    const q = useGet(["admin", "cross-booth"], "/admin/cross-booth");
    return <div><Title>{t("Cross-booth verification")}</Title>
      <p className="mb-3 text-sm text-slate-600">{t("Review inter-booth requests, approvals, grant expiry and verification steps recorded by visiting booth members.")}</p>
      <Async q={q}>{(rows) => rows.length ? <div className="space-y-3">{rows.map((r) => <article key={r.id} className="card space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{r.sourceBoothCode} → {r.targetBoothCode} · House {r.houseCode}</span><Badge s={r.status}/></div>
        <p className="text-sm">{r.requesterName} · {r.action === "VERIFY" ? "Verification access" : "Read-only access"}</p>
        <p className="text-sm text-slate-600">{r.reason}</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
          <span>Requested · {fmt(r.createdAt)}</span>
          <span>{r.approverName ? `Approved by ${r.approverName}` : "No approver yet"}</span>
          <span>{r.grantExpiresAt ? `Grant expires · ${fmt(r.grantExpiresAt)}` : `Request expires · ${fmt(r.expiresAt)}`}</span>
          <span className="font-medium text-stone-700">{Number(r.verificationCount)} {t("verification steps recorded")}</span>
        </div>
      </article>)}</div> : <Empty text="No cross-booth requests have been recorded."/>}</Async>
    </div>;
}
