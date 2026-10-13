import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import { ArrowRight, CalendarDays, ClipboardList, FileDown, FileUp, Settings, ShieldCheck, Users, Building2, ScrollText, UserCog } from "lucide-react";
import { Link } from "react-router-dom";
import { fmt } from "../../utils/format";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";

const LABELS = { booths: "Total booths", boothMembers: "Active booth members", households: "Households", pendingComplaints: "Pending complaints", inVerification: "In verification", resolved: "Resolved", upcomingEvents: "Upcoming events" };
const METRICS = [
  ["booths", Building2], ["boothMembers", Users], ["households", ShieldCheck],
  ["pendingComplaints", ClipboardList], ["inVerification", ShieldCheck], ["resolved", ClipboardList], ["upcomingEvents", CalendarDays],
];
const TOOLS = [
  ["/admin/citizens", "Citizens", Users], ["/admin/booths", "Booths", Building2], ["/admin/users", "Users", UserCog],
  ["/admin/events", "Events", CalendarDays], ["/admin/import", "Import", FileUp],
  ["/admin/exports", "Exports", FileDown], ["/admin/complaints", "Complaints", ClipboardList],
  ["/admin/audit-logs", "Audit logs", ScrollText], ["/admin/settings", "Settings", Settings],
];

export default function AdminDashboard() {
  const q = useGet(["admin", "dash"], "/admin/dashboard");
  const audit = useGet(["admin", "audit", "dashboard"], "/admin/audit-logs?limit=5");
  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-[#ffc400] p-5 text-stone-950 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider">{t("Admin home")}</p>
        <h1 className="mt-1 text-2xl font-extrabold">{t("All booths and houses")}</h1>
        <p className="mt-2 text-sm">{t("Use the buttons below to manage every booth, house and voter in your organisation.")}</p>
        <Link to="/admin/citizens" className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-bold text-slate-950 no-underline shadow-sm"><Users size={19}/>{t("Open voter list")}<ArrowRight size={18}/></Link>
      </section>
      <section><div className="section-heading"><h2>{t("Organisation overview")}</h2></div>
        <Async q={q}>{(d) => <div className="grid grid-cols-2 gap-3">{METRICS.filter(([key]) => d[key] !== undefined).map(([key, Icon]) => <div key={key} className="metric-card"><span className="metric-icon"><Icon size={20}/></span><strong>{d[key]}</strong><span>{t(LABELS[key])}</span></div>)}</div>}</Async>
      </section>

      <section><div className="section-heading"><h2>{t("What do you want to do?")}</h2></div><div className="grid grid-cols-2 gap-3">
        {TOOLS.map(([to, label, Icon]) => <Link key={to} to={to} className="tool-card"><span className="tool-icon"><Icon size={21}/></span><strong>{t(label)}</strong><span className="text-xs text-slate-500">{t("Open")} {t(label)}</span></Link>)}
      </div></section>

      <section>
        <div className="section-heading"><h2>{t("Recent activity")}</h2><Link to="/admin/audit-logs" className="section-action">{t("View all")} <ArrowRight size={15}/></Link></div>
        <Async q={audit}>{(rows) => rows.length ? <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">{rows.map((a) => <Link key={a.id} to="/admin/audit-logs" className="audit-activity-row text-inherit no-underline">
          <span className="tool-icon shrink-0"><ScrollText size={18}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{a.action.replaceAll("_", " ")}</strong><Badge s={a.outcome}/></div><p className="mt-1 text-xs text-slate-500">{a.resourceType}{a.reason ? ` · ${a.reason}` : ""}</p><p className="mt-1 text-xs text-slate-400">{fmt(a.createdAt)}</p></div><ArrowRight size={16} className="text-slate-400"/>
        </Link>)}</div> : <Empty text="Recorded administrative activity will appear here."/>}</Async>
      </section>
    </div>
  );
}
