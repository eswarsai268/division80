import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import Title from "../../components/Title";
import { fmt } from "../../utils/format";
import { useGet } from "../../hooks/useGet";

export default function AdminAudit() {
    const q = useGet(["admin", "audit"], "/admin/audit-logs?limit=100");
    return <div><Title>Audit logs</Title><Async q={q}>{(d) => d.length ? <>{d.map((a) => <div key={a.id} className="card mb-2 text-xs"><div className="flex justify-between"><span className="text-sm font-medium">{a.action}</span><Badge s={a.outcome}/></div><p className="text-slate-500">{a.resourceType}{a.scope ? ` · ${a.scope}` : ""}{a.reason ? ` · ${a.reason}` : ""}</p><p className="text-slate-400">{fmt(a.createdAt)} · req {String(a.requestId).slice(0, 8)}</p></div>)}</> : <Empty text="No audit events yet."/>}</Async></div>;
}
