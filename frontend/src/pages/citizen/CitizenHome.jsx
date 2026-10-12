import { Link } from "react-router-dom";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import Feed from "../../components/Feed";
import { ArrowRight, ClipboardList, ImagePlus, MapPin } from "lucide-react";
import { fmt } from "../../utils/format";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";

export default function CitizenHome() {
    const ev = useGet(["events"], "/public/events");
    const an = useGet(["announcements"], "/public/announcements");
    const mine = useGet(["complaints", "mine", 5], "/complaints/mine?limit=5");
    return (<div className="space-y-5">
      <section className="citizen-hero">
        <div className="citizen-hero-art" aria-hidden="true"><ImagePlus size={30} strokeWidth={1.5}/></div>
        <div className="relative z-10">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-100">{t("Your community, in reach")}</p>
          <h2 className="max-w-sm text-2xl font-bold leading-tight text-white">{t("Help build a better community.")}</h2>
          <p className="mt-2 max-w-sm text-sm leading-5 text-white/85">{t("Report local issues, follow their progress, and stay informed.")}</p>
          <Link to="/complaints/new" className="btn mt-4 rounded-full"><ClipboardList size={17}/> {t("Submit a complaint")}</Link>
        </div>
        <div className="citizen-hero-image-placeholder"><ImagePlus size={14}/> {t("Community banner image")}</div>
      </section>

      <section className="grid grid-cols-2 gap-3" aria-label={t("Complaint summary")}>
        <div className="data-placeholder"><span className="data-placeholder-value">—</span><span className="data-placeholder-label">{t("My issues")}</span><span className="data-placeholder-note">Summary data slot</span></div>
        <div className="data-placeholder"><span className="data-placeholder-value">—</span><span className="data-placeholder-label">{t("Resolved")}</span><span className="data-placeholder-note">Summary data slot</span></div>
      </section>

      <section>
        <div className="section-heading"><h2>{t("Recent issues & updates")}</h2><Link to="/complaints" className="section-action">{t("View all")} <ArrowRight size={15}/></Link></div>
        <Async q={mine}>{(d) => d.items.length ? <div className="space-y-2">{d.items.map((c) => <Link key={c.id} to={`/complaints/${c.id}`} className="card activity-card">
          <div className="flex min-w-0 items-center gap-2"><Badge s={c.status}/><span className="truncate text-xs text-slate-500">{c.category}</span></div>
          <p className="mt-2 font-semibold leading-snug">{c.title}</p>
          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><MapPin size={13}/>{c.location || "Location not provided"}<span className="ml-auto">{fmt(c.createdAt)}</span></p>
        </Link>)}</div> : <Empty text="Your submitted issues will appear here."/>}</Async>
      </section>

      <section><div className="section-heading"><h2>{t("Latest announcements")}</h2></div><Async q={an}>{(rows) => <Feed items={rows} empty="Announcements will appear here when published."/>}</Async></section>

      <section><div className="section-heading"><h2>{t("Published events")}</h2><Link to="/events" className="section-action">{t("All events")} <ArrowRight size={15}/></Link></div><Async q={ev}>{(d) => <Feed items={d?.slice(0, 3)} empty="Published events will appear here."/>}</Async></section>
    </div>);
}
