import { Link } from "react-router-dom";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import Feed from "../../components/Feed";
import { ArrowRight, CheckCircle2, Clock3, Home, Search, ShieldCheck, Users } from "lucide-react";
import { fmt } from "../../utils/format";
import { useGet } from "../../hooks/useGet";
import { useMe } from "../../auth/useMe";
import { isOfflineFallbackError, readOfflineSnapshot } from "../../services/offlineRoster";
import { api } from "../../api/client";
import { t } from "../../i18n";

export default function BoothDashboard() {
  const { data: me } = useMe();
  const offline = Boolean(me?.isOffline || !navigator.onLine);
  const cachedGet = (path, snapshot, fallback) => async ({ signal }) => {
    if (offline) {
      const saved = await readOfflineSnapshot(snapshot);
      if (saved !== null) return saved;
      if (fallback !== undefined) return fallback;
      throw new Error("This information has not been saved on this device. Reconnect and open this page to cache it.");
    }
    try { return await api(path, { signal }); }
    catch (error) {
      if (!isOfflineFallbackError(error)) throw error;
      const saved = await readOfflineSnapshot(snapshot);
      if (saved !== null) return saved;
      if (fallback !== undefined) return fallback;
      throw error;
    }
  };
  const q = useGet(["booth", "dashboard"], "/booth/dashboard", { queryFn: cachedGet("/booth/dashboard", "dashboard") });
  const verifications = useGet(["booth", "verifications", "recent"], "/booth/verifications", { queryFn: cachedGet("/booth/verifications", "verifications", []) });
  const events = useGet(["public", "events"], "/public/events", { queryFn: cachedGet("/public/events", "events", []) });
  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-brand-600 p-5 text-white shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.14em]">{t("Booth member home")}</p>
        <h1 className="mt-1 text-2xl font-extrabold">{t("Door-to-door visit")}</h1>
        <p className="mt-2 text-sm">{t("Start with your assigned houses. Your saved work stays in the system.")}</p>
        <Link to="/booth/households" className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-bold text-slate-950 no-underline shadow-sm"><Search size={19}/>{t("Open my houses")}<ArrowRight size={18}/></Link>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-bold text-slate-900">{t("How to use")}</h2>
        <ol className="mt-3 space-y-3 text-sm text-slate-700">
          <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-100 font-bold">1</span><span>{t("Choose your booth and find the house.")}</span></li>
          <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-100 font-bold">2</span><span>{t("Open the house and check each person.")}</span></li>
          <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-100 font-bold">3</span><span>{t("Save the visit details before leaving.")}</span></li>
        </ol>
      </section>
      <section>
        <div className="section-heading"><h2>{t("Booth summary")}</h2><Link to="/booth/households" className="section-action">{t("View households")} <ArrowRight size={15}/></Link></div>
        <Async q={q}>{(d) => {
        const h = d.households ?? {};
        const cards = [
          [Home, h.PENDING + h.IN_VERIFICATION + h.RESOLVED, "Households"],
          [Clock3, h.PENDING + h.IN_VERIFICATION, "Pending visits"],
          [CheckCircle2, h.RESOLVED, "Verified households"],
        ];
        return <div className="grid grid-cols-2 gap-3">{cards.map(([Icon, value, label]) => <div key={label} className="metric-card"><span className="metric-icon"><Icon size={20}/></span><strong>{value}</strong><span>{t(label)}</span></div>)}</div>;
      }}</Async>
      </section>

      <section><div className="section-heading"><h2>{t("Upcoming activity")}</h2></div><Async q={events}>{(rows) => rows?.length ? <div className="feature-event"><div><p className="text-xs font-semibold uppercase tracking-wide text-amber-950/70">{t("Community event")}</p><h3 className="mt-1 text-xl font-bold">{rows[0].title}</h3><p className="mt-2 text-sm text-amber-950/80">{rows[0].startsAt ? fmt(rows[0].startsAt) : rows[0].body}</p></div><Link to="/events" className="feature-event-action" aria-label={t("View community events")}><ArrowRight size={21}/></Link></div> : <div className="data-placeholder-wide"><span>{t("No published events yet")}</span><small>{t("Upcoming community activity will appear here.")}</small></div>}</Async></section>

      <section>
        <div className="section-heading"><h2>{t("Recent verifications")}</h2><Link to="/booth/verifications" className="section-action">{t("View all")} <ArrowRight size={15}/></Link></div>
        <Async q={verifications}>{(rows) => rows.length ? <div className="space-y-2">{rows.slice(0, 4).map((v) => <Link key={v.id} to="/booth/verifications" className="card activity-card">
          <div className="flex items-center justify-between gap-2"><span className="font-semibold">{t("House")} {v.houseCode}</span><Badge s={v.result}/></div>
          <p className="mt-1 text-sm text-slate-600">{v.citizenName} · Step {v.step}</p><p className="mt-2 text-xs text-slate-500">{fmt(v.createdAt)}</p>
        </Link>)}</div> : <Empty text="Recorded verification activity will appear here."/>}</Async>
      </section>

      <section><div className="section-heading"><h2>{t("Quick tools")}</h2></div><div className="grid grid-cols-2 gap-3">
        <Link to="/booth/verifications" className="tool-card"><span className="tool-icon"><ShieldCheck size={21}/></span><span>{t("Verifications")}</span></Link>
        <Link to="/booth/households" className="tool-card"><span className="tool-icon"><Users size={21}/></span><span>{t("Households")}</span></Link>
      </div></section>
    </div>
  );
}
