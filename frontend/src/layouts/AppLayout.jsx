import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { loginFor } from "../auth/paths";
import { NAV } from "../auth/navConfig";
import { useMe } from "../auth/useMe";
import { logout } from "../services/authService";
import { useLanguage } from "../i18n";

/** Shell for signed-in pages: header + content + bottom navigation (mobile first). */
export default function AppLayout() {
  const { data: me } = useMe();
  const { language } = useLanguage();
  const qc = useQueryClient();
  const nav = useNavigate();
  if (!me) return null;
  const onLogout = async () => { await logout(); qc.clear(); nav(loginFor(me.role)); };
  return (
    <div className="app-shell mx-auto min-h-screen max-w-3xl">
      <AppHeader me={me} />
      <main key={language} className="p-4"><Outlet context={{ onLogout }} /></main>
      <BottomNav {...NAV[me.role]} />
    </div>
  );
}
