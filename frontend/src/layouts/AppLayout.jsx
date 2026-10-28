import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { loginFor } from "../auth/paths";
import { NAV } from "../auth/navConfig";
import { useMe } from "../auth/useMe";
import { logout } from "../services/authService";
import { isOfflineRosterDisabled, syncOfflineRoster } from "../services/offlineRoster";
import { useLanguage } from "../i18n";

/** Shell for signed-in pages: header + content + bottom navigation (mobile first). */
export default function AppLayout() {
  const { data: me } = useMe();
  const { language } = useLanguage();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [online, setOnline] = useState(() => navigator.onLine);
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
    syncOfflineRoster(me).catch(() => {
      // Keep the previous local copy when a refresh cannot complete.
    });
    return undefined;
  }, [me?.id, me?.organizationId, me?.isOffline, me?.role, me?.boothIds?.join(","), online, offlineDisabled, offlinePreferenceReady, syncCheck]);
  if (!me) return null;
  const onLogout = async () => {
    try { await logout(); } catch { /* Local data must still be removed when offline. */ }
    qc.clear();
    nav(loginFor(me.role));
  };
  return (
    <div className="app-shell mx-auto min-h-screen max-w-3xl">
      <AppHeader me={me} onLogout={onLogout} />
      <main key={language} className="p-4"><Outlet context={{ onLogout }} /></main>
      <BottomNav {...NAV[me.role]} />
    </div>
  );
}
