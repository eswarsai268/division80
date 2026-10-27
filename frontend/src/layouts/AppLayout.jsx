import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { loginFor } from "../auth/paths";
import { NAV } from "../auth/navConfig";
import { useMe } from "../auth/useMe";
import { logout } from "../services/authService";
import { clearOfflineRoster, getOfflineInfo, isOfflineRosterDisabled, setOfflineRosterDisabled, syncOfflineRoster } from "../services/offlineRoster";
import { useLanguage } from "../i18n";

const FRESH_OFFLINE_COPY_MS = 6 * 60 * 60 * 1000;

/** Shell for signed-in pages: header + content + bottom navigation (mobile first). */
export default function AppLayout() {
  const { data: me } = useMe();
  const { language } = useLanguage();
  const qc = useQueryClient();
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
      if (saved && Date.now() - saved.updatedAt < FRESH_OFFLINE_COPY_MS) return;
      if (active) {
        setSyncError("");
        setSyncProgress({ completed: 0, total: saved?.householdCount ?? null });
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
  const onLogout = async () => {
    try { await logout(); } catch { /* Local data must still be removed when offline. */ }
    qc.clear();
    nav(loginFor(me.role));
  };
  return (
    <div className="app-shell mx-auto min-h-screen max-w-3xl">
      <AppHeader me={me} />
      {me.role === "BOOTH_MEMBER" && (offlineMode || syncProgress || syncError || offlineInfo || offlineDisabled) && <div className={`mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs ${offlineMode ? "bg-amber-100 text-amber-950" : syncError ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"}`} role="status">
        <span>{offlineDisabled ? "Offline copy removed from this device." : offlineMode ? "Offline mode: searching and printing use the saved roster. Verification and admin functions need internet." : syncProgress ? `Preparing offline roster: ${syncProgress.completed.toLocaleString()}${syncProgress.total ? ` of ${syncProgress.total.toLocaleString()}` : ""} houses.` : syncError || `Offline roster ready: ${offlineInfo?.householdCount.toLocaleString()} houses and ${offlineInfo?.peopleCount.toLocaleString()} people. It refreshes when you are online.`}</span>
        {offlineDisabled ? <button className="shrink-0 font-bold underline disabled:opacity-50" type="button" disabled={!online} onClick={() => {
          setOfflineRosterDisabled(me.id, false);
          setOfflineDisabled(false);
        }}>Download offline copy</button> : (offlineInfo || me.isOffline) && <button className="shrink-0 font-bold underline" type="button" onClick={async () => {
          await clearOfflineRoster().catch(() => undefined);
          qc.removeQueries({ queryKey: ["booth"] });
          setOfflineInfo(null);
          setOfflineRosterDisabled(me.id, true);
          setOfflineDisabled(true);
          if (offlineMode) {
            qc.clear();
            nav(loginFor(me.role));
          }
        }}>Clear offline copy</button>}
      </div>}
      <main key={language} className="p-4"><Outlet context={{ onLogout }} /></main>
      <BottomNav {...(offlineMode && me.role === "BOOTH_MEMBER" ? { ...NAV.BOOTH_MEMBER, main: NAV.BOOTH_MEMBER.main.filter((item) => item.to === "/booth/households") } : NAV[me.role])} />
    </div>
  );
}
