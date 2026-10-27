import Async from "../../components/Async";
import { ArrowRight, CalendarDays, FileDown, FileUp, Settings, ShieldCheck, Users, Building2, UserCog } from "lucide-react";
import { Link } from "react-router-dom";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";

const LABELS = { booths: "Total booths", boothMembers: "Active booth members", households: "Households", upcomingEvents: "Upcoming events" };
const METRICS = [["booths", Building2], ["boothMembers", Users], ["households", ShieldCheck], ["upcomingEvents", CalendarDays]];
const TOOLS = [
  ["/admin/citizens", "Citizens", Users], ["/admin/booths", "Booths", Building2], ["/admin/users", "Users", UserCog],
  ["/admin/events", "Events", CalendarDays], ["/admin/import", "Import", FileUp], ["/admin/exports", "Exports", FileDown], ["/admin/settings", "Settings", Settings],
];

export default function AdminDashboard() {
  const q = useGet(["admin", "dash"], "/admin/dashboard");
  return <div className="space-y-5">
    <section className="rounded-3xl bg-brand-600 p-5 text-white shadow-sm">
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
  </div>;
}
