import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import Title from "../../components/Title";
import { useGet } from "../../hooks/useGet";

export default function BoothComplaints() {
    const q = useGet(["booth", "complaints"], "/booth/complaints");
    return <div><Title>Complaints in my booths</Title><Async q={q}>{(d) => d.length ? <>{d.map((c) => <div key={c.id} className="card mb-2"><div className="flex justify-between"><span className="text-sm font-medium">{c.title}</span><Badge s={c.status}/></div><p className="text-sm text-slate-600">{c.description}</p></div>)}</> : <Empty text="No complaints assigned to your booths."/>}</Async></div>;
}
