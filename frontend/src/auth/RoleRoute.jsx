import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import AccessDenied from "../pages/AccessDenied";
import { useMe } from "./useMe";
import { getOfflineIdentity } from "../services/offlineRoster";
import { t } from "../i18n";

/** UX-only guard. The API is the authority: a 403 shows "Access denied" and never bounces to login. */
export default function RoleRoute({ roles }) {
  const { pathname } = useLocation();
  const { data: me, isLoading, error } = useMe();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [offlineIdentity, setOfflineIdentity] = useState(null);
  const [offlineCheckPending, setOfflineCheckPending] = useState(() => !navigator.onLine);
  useEffect(() => {
    const update = () => {
      const isOnline = navigator.onLine;
      setOnline(isOnline);
      setOfflineCheckPending(!isOnline);
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (online) {
      setOfflineIdentity(null);
      setOfflineCheckPending(false);
      return undefined;
    }
    let active = true;
    setOfflineCheckPending(true);
    getOfflineIdentity().then((identity) => {
      if (active) setOfflineIdentity(identity);
    }).catch(() => {
      if (active) setOfflineIdentity(null);
    }).finally(() => {
      if (active) setOfflineCheckPending(false);
    });
    return () => { active = false; };
  }, [online]);
  if ((online && isLoading) || (!online && offlineCheckPending)) return <div className="p-8 text-center text-slate-500">{t("Loading…")}</div>;
  const activeIdentity = online ? me : offlineIdentity;
  const networkOffline = !online || error?.status === 0;
  if (networkOffline && (!activeIdentity)) {
    // Don't redirect to login when offline; stay on the current page.
    return <div className="p-8 text-center text-slate-500">{t("You are offline. Reconnect to continue.")}</div>;
  }
  if (online && (!activeIdentity || error?.status === 401)) {
    return <Navigate to={pathname.startsWith("/admin") ? "/admin/login" : "/booth/login"} replace />;
  }
  if (!roles.includes(activeIdentity.role)) return <AccessDenied role={activeIdentity.role} />;
  if (activeIdentity.role === "ADMIN" && !online) return <div className="mx-auto mt-12 max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-slate-800"><h1 className="text-lg font-bold">Internet connection required</h1><p className="mt-2 text-sm">Admin tools are available when you are back online.</p></div>;
  if (activeIdentity.role === "BOOTH_MEMBER" && (activeIdentity.isOffline || !online) && !/^\/booth\/households(?:\/[^/]+(?:\/citizens)?)?$/.test(pathname)) return <Navigate to="/booth/households" replace />;
  return <Outlet />;
}

