import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import Title from "../../components/Title";
import { fmt } from "../../utils/format";
import { useGet } from "../../hooks/useGet";

export default function VerificationsPage() {
    const q = useGet(["booth", "verifications"], "/booth/verifications");
    return <div><Title>Recent verifications</Title><Async q={q}>{(d) => d.length ? <>{d.map((v) => <div key={v.id} className="card mb-2 text-sm"><div className="flex justify-between"><span>House {v.houseCode} · {v.citizenName}</span><Badge s={v.result}/></div><p className="text-xs text-slate-500">Step {v.step} · {v.verifier} · {fmt(v.createdAt)}</p></div>)}</> : <Empty text="No verifications recorded yet."/>}</Async></div>;
}
