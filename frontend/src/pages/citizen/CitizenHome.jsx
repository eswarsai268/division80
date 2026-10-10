import { Link } from "react-router-dom";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import Feed from "../../components/Feed";
import { useGet } from "../../hooks/useGet";

export default function CitizenHome() {
    const ev = useGet(["events"], "/public/events");
    const an = useGet(["announcements"], "/public/announcements");
    const mine = useGet(["complaints", "mine", 5], "/complaints/mine?limit=5");
    return (<div className="space-y-5">
      <section><h2 className="mb-2 font-semibold text-brand-900">New issues & resolution updates</h2>
        <Async q={mine}>{(d) => d.items.length ? <>{d.items.map((c) => <Link key={c.id} to={`/complaints/${c.id}`} className="card mb-2 flex items-center justify-between"><span className="text-sm">{c.title}</span><Badge s={c.status}/></Link>)}</> : <Empty text="No complaints yet."/>}</Async>
        <Link to="/complaints/new" className="btn mt-2 w-full">Submit a complaint</Link></section>
      <section><h2 className="mb-2 font-semibold text-brand-900">Announcements</h2><Feed items={an.data} empty="No announcements."/></section>
      <section><div className="mb-2 flex justify-between"><h2 className="font-semibold text-brand-900">Upcoming events</h2><Link to="/events" className="text-sm text-brand-600 underline">All events</Link></div><Feed items={ev.data?.slice(0, 3)} empty="No upcoming events."/></section>
    </div>);
}
