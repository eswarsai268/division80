import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { loginFor } from "../auth/paths";
import { NAV } from "../auth/navConfig";
import { useMe } from "../auth/useMe";
import { logout } from "../services/authService";
import { clearOfflineRoster, getOfflineInfo, isOfflineRosterDisabled, setOfflineRosterDisabled, syncOfflineRoster } from "../services/offlineRoster";
import { useLanguage } from "../i18n";

/** Shell for signed-in pages: header + content + bottom navigation (mobile first). */
export default function AppLayout() {
  const { data: me } = useMe();
  const { language } = useLanguage();
  const qc = useQueryClient();
  const location = useLocation();
  const nav = useNavigate();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [offlineInfo, setOfflineInfo] = useState(null);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncError, setSyncError] = useState("");
  const [offlineDisabled, setOfflineDisabled] = useState(false);
  const [offlinePreferenceReady, setOfflinePreferenceReady] = useState(false);
  const [syncCheck, setSyncCheck] = useState(0);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const checkSync = () => setSyncCheck((value) => value + 1);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("focus", checkSync);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("focus", checkSync);
    };
  }, []);
  useEffect(() => {
    if (!online || me?.role !== "BOOTH_MEMBER" || me.isOffline) return undefined;
    const timer = window.setInterval(() => setSyncCheck((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [me?.role, me?.isOffline, online]);
  useEffect(() => {
    if (!me?.id) return;
    setOfflineDisabled(isOfflineRosterDisabled(me.id));
    setOfflinePreferenceReady(true);
  }, [me?.id]);
  useEffect(() => {
    if (!offlinePreferenceReady || me?.role !== "BOOTH_MEMBER" || !me.id || me.isOffline || !online || offlineDisabled || isOfflineRosterDisabled(me.id)) return undefined;
    let active = true;
    (async () => {
      const saved = await getOfflineInfo().catch(() => null);
      if (active) setOfflineInfo(saved);
      if (active) {
        setSyncError("");
      }
      try {
        const next = await syncOfflineRoster(me, (progress) => {
          if (active) setSyncProgress(progress);
        });
        if (active) {
          setOfflineInfo(next);
          setSyncProgress(null);
        }
      } catch {
        if (active) {
          setSyncError("Offline roster could not be refreshed. The previous saved copy is kept when available.");
          setSyncProgress(null);
        }
      }
    })();
    return () => { active = false; };
  }, [me?.id, me?.organizationId, me?.isOffline, me?.role, me?.boothIds?.join(","), online, offlineDisabled, offlinePreferenceReady, syncCheck]);
  useEffect(() => {
    if (me?.isOffline) getOfflineInfo().then(setOfflineInfo).catch(() => setOfflineInfo(null));
  }, [me?.isOffline]);
  if (!me) return null;
  const offlineMode = me.isOffline || !online;
  const offlineHouseholdsRoute = /^\/booth\/households(?:\/[^/]+(?:\/citizens)?)?$/.test(location.pathname);
  const showOfflineUnavailable = me.role === "BOOTH_MEMBER" && offlineMode && !offlineHouseholdsRoute;
  const onLogout = async () => {
    try { await logout(); } catch { /* Local data must still be removed when offline. */ }
    qc.clear();
    nav(loginFor(me.role));
  };
  return (
    <div className="app-shell mx-auto min-h-screen max-w-3xl">
      <AppHeader me={me} onLogout={onLogout} />
      <main key={language} className="p-4">{showOfflineUnavailable ? <section className="card space-y-3 text-center">
        <h1 className="text-lg font-bold">Internet connection required</h1>
        <p className="text-sm text-slate-600">Dashboard, verification activity, and events need an internet connection. Your saved house roster, search, and printing are available offline.</p>
        <Link className="btn inline-flex justify-center" to="/booth/households">Open houses</Link>
      </section> : <Outlet context={{ onLogout }} />}</main>
      <BottomNav {...NAV[me.role]} />
    </div>
  );
}
