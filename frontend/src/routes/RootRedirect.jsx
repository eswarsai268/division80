import { Navigate } from "react-router-dom";
import { homeFor } from "../auth/paths";
import { useMe } from "../auth/useMe";
import { t } from "../i18n";

export default function RootRedirect() {
  const { data: me, isLoading, error } = useMe();
  if (isLoading) return null;
  if (!me && typeof navigator !== "undefined" && !navigator.onLine) {
    return <main className="mx-auto max-w-md p-6 pt-16 text-center">
      <h1 className="text-xl font-bold">{t("Offline copy unavailable")}</h1>
      <p className="mt-3 text-sm text-slate-600">{t("Reconnect, sign in as a booth member, and wait for the offline roster to finish downloading. Then you can reopen the app without internet.")}</p>
      {error?.message && <p className="mt-3 text-xs text-slate-500">{t("The saved booth identity or roster could not be read on this device.")}</p>}
    </main>;
  }
  return <Navigate to={me ? homeFor(me.role) : "/booth/login"} replace />;
}









