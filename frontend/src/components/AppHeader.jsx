import { Bike } from "lucide-react";
import { APP_NAME } from "../utils/constants";
import { t, useLanguage } from "../i18n";
import BackButton from "./BackButton";
import { homeFor } from "../auth/paths";

export default function AppHeader({ me }) {
  const { language, setLanguage } = useLanguage();
  return (
    <header className="app-top-nav">
      <div className="app-top-nav-inner">
        <div className="app-top-nav-back"><BackButton fallback={homeFor(me.role)} /></div>
        <div className="app-top-nav-brand">
          <Bike className="shrink-0 text-stone-900" size={25} aria-hidden="true" />
          <p className="app-brand-name">{APP_NAME}</p>
        </div>
        <div className="app-top-nav-language">
          <label className="sr-only" htmlFor="app-language">{t("Language")}</label>
          <select id="app-language" value={language} onChange={(event) => setLanguage(event.target.value)} className="rounded-full border border-amber-700/25 bg-amber-50 px-2 py-2 text-xs font-semibold text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900" aria-label={t("Language")}>
            <option value="en">{t("English")}</option>
            <option value="te">{t("తెలుగు")}</option>
          </select>
        </div>
      </div>
    </header>
  );
}
