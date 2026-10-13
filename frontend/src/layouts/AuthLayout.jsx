import { Bike, ShieldCheck } from "lucide-react";
import { useGet } from "../hooks/useGet";
import { APP_NAME } from "../utils/constants";
import { t, useLanguage } from "../i18n";
import { useLocation } from "react-router-dom";
import BackButton from "../components/BackButton";

export default function AuthLayout({ title, subtitle, children }) {
  const { language, setLanguage } = useLanguage();
  const location = useLocation();
  const media = useGet(["public", "login-media"], "/auth/login-media", { staleTime: 60_000 });
  const backFallback = location.pathname === "/login" ? "/register" : "/login";
  return (
    <main className="min-h-screen bg-[#f3f4f8] px-4 py-6 sm:flex sm:items-center sm:justify-center sm:px-6">
      <div className="mx-auto w-full max-w-md">
        <header className="relative mb-4 overflow-hidden rounded-3xl bg-[#ffc400] p-5 text-stone-950 shadow-sm">
          {media.data?.loginVideoUrl && <video className="absolute inset-0 h-full w-full object-cover opacity-15" src={media.data.loginVideoUrl} autoPlay muted loop playsInline />}
          <div className="relative flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-stone-900"><Bike size={26}/></span>
            <div className="min-w-0"><p className="auth-brand-name">{APP_NAME}</p><p className="mt-1 text-xs font-medium">{t("Community services")}</p></div>
          </div>
        </header>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center justify-between">
            <BackButton fallback={backFallback}/>
            <label className="sr-only" htmlFor="auth-language">{t("Language")}</label>
            <select id="auth-language" value={language} onChange={(event) => setLanguage(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600" aria-label={t("Language")}>
              <option value="en">{t("English")}</option><option value="te">{t("తెలుగు")}</option>
            </select>
          </div>
          <p className="mb-1 text-sm font-bold text-amber-800">{t("Welcome")}</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{t(title)}</h1>
          <p className="mb-5 mt-2 text-sm leading-6 text-slate-600">{t(subtitle || "Create your account to get started.")}</p>
          {children}
          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck size={15} className="text-emerald-700"/>{t("Secure sign in")}</div>
          {media.error && <p className="mt-3 text-center text-xs text-slate-500">{t("Login video is unavailable. You can still sign in.")}</p>}
        </section>
      </div>
    </main>
  );
}
