import { Link } from "react-router-dom";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import Title from "../../components/Title";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";

export default function ComplaintList() {
    const q = useGet(["complaints", "mine", 50], "/complaints/mine?limit=50");
    return <div className="space-y-2"><Title>{t("My complaints")}</Title><Link to="/complaints/new" className="btn w-full">{t("New complaint")}</Link>
    <Async q={q}>{(d) => d.items.length ? <>{d.items.map((c) => <Link key={c.id} to={`/complaints/${c.id}`} className="card flex items-center justify-between"><span className="text-sm">{c.title}</span><Badge s={c.status}/></Link>)}</> : <Empty text="You haven't submitted any complaints."/>}</Async></div>;
}
