import { Link } from "react-router-dom";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import Title from "../../components/Title";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";

export default function AdminBooths() {
    const q = useGet(["admin", "booths"], "/admin/booths");
    return <div className="space-y-3"><Title>{t("Booths")}</Title>
    <Async q={q}>{(d) => d.length ? <>{d.map((b) => <Link key={b.id} to={`/admin/booths/${b.id}`} className="card mb-2 flex justify-between"><span>{b.code} — {b.name}</span><Badge s={b.status}/></Link>)}</> : <Empty text="No booths yet."/>}</Async></div>;
}
