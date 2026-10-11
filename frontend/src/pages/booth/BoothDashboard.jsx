import { Link } from "react-router-dom";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import Feed from "../../components/Feed";
import { ArrowRight, CheckCircle2, ClipboardList, Clock3, Home, Search, ShieldCheck, Users } from "lucide-react";
import { fmt } from "../../utils/format";
import { useGet } from "../../hooks/useGet";

export default function BoothDashboard() {
  const q = useGet(["booth", "dashboard"], "/booth/dashboard");
  const verifications = useGet(["booth", "verifications", "recent"], "/booth/verifications");
  const events = useGet(["public", "events"], "/public/events");
  return (
    <div className="space-y-5">
      <section className="quick-retrieval">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Field workspace</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Quick retrieval</h1><p className="text-sm text-slate-500">Search by house code or citizen ID</p></div>
        <Link to="/booth/households" className="search-launch"><Search size={19}/><span>Search households</span><ArrowRight className="ml-auto" size={18}/></Link>
      </section>
      <section>
        <div className="section-heading"><h2>Booth summary</h2><Link to="/booth/households" className="section-action">View households <ArrowRight size={15}/></Link></div>
        <Async q={q}>{(d) => {
        const c = d.complaints ?? {};
        const h = d.households ?? {};
        const pending = (c.SUBMITTED ?? 0) + (c.UNDER_REVIEW ?? 0) + (c.ASSIGNED ?? 0);
        const cards = [
          [Home, h.PENDING + h.IN_VERIFICATION + h.RESOLVED, "Households"],
          [Clock3, h.PENDING + h.IN_VERIFICATION, "Pending visits"],
          [ClipboardList, pending, "Open complaints"],
          [CheckCircle2, h.RESOLVED, "Verified households"],
        ];
        return <div className="grid grid-cols-2 gap-3">{cards.map(([Icon, value, label]) => <div key={label} className="metric-card"><span className="metric-icon"><Icon size={20}/></span><strong>{value}</strong><span>{label}</span></div>)}</div>;
      }}</Async>
      </section>

      <section><div className="section-heading"><h2>Upcoming activity</h2></div><Async q={events}>{(rows) => rows?.length ? <div className="feature-event"><div><p className="text-xs font-semibold uppercase tracking-wide text-amber-950/70">Community event</p><h3 className="mt-1 text-xl font-bold">{rows[0].title}</h3><p className="mt-2 text-sm text-amber-950/80">{rows[0].startsAt ? fmt(rows[0].startsAt) : rows[0].body}</p></div><Link to="/events" className="feature-event-action" aria-label="View community events"><ArrowRight size={21}/></Link></div> : <div className="data-placeholder-wide"><span>No published events yet</span><small>Upcoming community activity will appear here.</small></div>}</Async></section>

      <section>
        <div className="section-heading"><h2>Recent verifications</h2><Link to="/booth/verifications" className="section-action">View all <ArrowRight size={15}/></Link></div>
        <Async q={verifications}>{(rows) => rows.length ? <div className="space-y-2">{rows.slice(0, 4).map((v) => <Link key={v.id} to="/booth/verifications" className="card activity-card">
          <div className="flex items-center justify-between gap-2"><span className="font-semibold">House {v.houseCode}</span><Badge s={v.result}/></div>
          <p className="mt-1 text-sm text-slate-600">{v.citizenName} · Step {v.step}</p><p className="mt-2 text-xs text-slate-500">{fmt(v.createdAt)}</p>
        </Link>)}</div> : <Empty text="Recorded verification activity will appear here."/>}</Async>
      </section>

      <section><div className="section-heading"><h2>Quick tools</h2></div><div className="grid grid-cols-3 gap-3">
        <Link to="/booth/complaints" className="tool-card"><span className="tool-icon"><ClipboardList size={21}/></span><span>Complaints</span></Link>
        <Link to="/booth/verifications" className="tool-card"><span className="tool-icon"><ShieldCheck size={21}/></span><span>Verifications</span></Link>
        <Link to="/booth/households" className="tool-card"><span className="tool-icon"><Users size={21}/></span><span>Households</span></Link>
      </div></section>
    </div>
  );
}
