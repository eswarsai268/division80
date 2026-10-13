import { Bike, LogOut } from "lucide-react";
import { APP_NAME } from "../utils/constants";
import { t, useLanguage } from "../i18n";
import BackButton from "./BackButton";
import { homeFor } from "../auth/paths";

export default function AppHeader({ me, onLogout }) {
  const { language, setLanguage } = useLanguage();
  return (
    <header className="app-top-nav">
    <div className="app-top-nav-inner flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-2">
          <BackButton fallback={homeFor(me.role)} />
          <Bike className="shrink-0 text-stone-900" size={25} />
          <div className="min-w-0">
           <p className="app-brand-name text-base font-bold leading-tight sm:text-lg">
  {APP_NAME}
</p>
            <p className="truncate text-xs text-stone-800">{me.fullName} · {t(me.role.replace("_", " "))}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <label className="sr-only" htmlFor="app-language">{t("Language")}</label>
          <select id="app-language" value={language} onChange={(event) => setLanguage(event.target.value)} className="rounded-full border border-amber-700/25 bg-amber-50 px-2 py-2 text-xs font-semibold text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900" aria-label={t("Language")}>
            <option value="en">{t("English")}</option>
            <option value="te">{t("తెలుగు")}</option>
          </select>
          <button onClick={onLogout} className="flex items-center gap-1 rounded-full border border-amber-700/20 bg-amber-50 px-3 py-2 text-sm font-semibold text-stone-900 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900" aria-label={t("Log out")}><LogOut size={16} /> {language === "te" ? "లాగ్ అవుట్" : "Logout"}</button>
        </div>
      </div>
    </header>
  );
}
