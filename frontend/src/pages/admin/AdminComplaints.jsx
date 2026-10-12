import { Link } from "react-router-dom";
import { useState } from "react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import Title from "../../components/Title";
import { fmt } from "../../utils/format";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";

export default function AdminComplaints() {
    const [status, setStatus] = useState("");
    const q = useGet(["admin", "complaints", status], `/admin/complaints?limit=50${status ? `&status=${status}` : ""}`);
    return <div className="space-y-2"><Title>{t("Complaints")}</Title>
    <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t("Filter by status")}><option value="">{t("All statuses")}</option>{["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_VERIFICATION", "RESOLVED", "REJECTED", "REOPENED"].map((s) => <option key={s} value={s}>{t(s.replace(/_/g, " "))}</option>)}</select>
    <Async q={q}>{(d) => d.items.length ? <>{d.items.map((c) => <Link key={c.id} to={`/admin/complaints/${c.id}`} className="card flex items-center justify-between"><div><p className="text-sm font-medium">{c.title}</p><p className="text-xs text-slate-500">{c.category} · {fmt(c.createdAt)}</p></div><Badge s={c.status}/></Link>)}</> : <Empty text="No complaints."/>}</Async></div>;
}
