import { Fan, LogOut } from "lucide-react";
import { APP_NAME } from "../utils/constants";
import { t, useLanguage } from "../i18n";
import BackButton from "./BackButton";
import { homeFor } from "../auth/paths";

export default function AppHeader({ me, onLogout }) {
  const { language, setLanguage } = useLanguage();
  return (
    <header className="app-top-nav">
      <div className="app-top-nav-inner">
        <div className="app-top-nav-back"><BackButton fallback={homeFor(me.role)} /></div>
        <div className="app-top-nav-brand">
          <Fan className="shrink-0 text-white" size={25} aria-hidden="true" />
          <p className="app-brand-name">{APP_NAME}</p>
        </div>
        <div className="app-top-nav-actions">
          <div className="app-top-nav-language">
            <label className="sr-only" htmlFor="app-language">{t("Language")}</label>
            <select id="app-language" value={language} onChange={(event) => setLanguage(event.target.value)} className="rounded-full border border-white/30 bg-white px-2 py-2 text-xs font-semibold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label={t("Language")}>
              <option value="en">{t("English")}</option>
              <option value="te">{"\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41"}</option>
            </select>
          </div>
          <button type="button" onClick={onLogout} className="app-top-nav-logout inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/30 bg-white px-3 py-2 text-xs font-bold text-slate-900 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label={t("Logout")}>
            <LogOut size={16} aria-hidden="true" />
            <span className="app-top-nav-logout-label">{t("Logout")}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
