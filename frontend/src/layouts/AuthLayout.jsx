import { ArrowRight, Bike, ShieldCheck } from "lucide-react";
import { useGet } from "../hooks/useGet";
import { APP_NAME } from "../utils/constants";
import { t, useLanguage } from "../i18n";

export default function AuthLayout({ title, subtitle, children }) {
  const { language, setLanguage } = useLanguage();
  const media = useGet(["public", "login-media"], "/auth/login-media", { staleTime: 60_000 });
  return (
    <main className="min-h-screen overflow-hidden bg-[#fff7e5]">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative flex min-h-[34vh] flex-col justify-between overflow-hidden bg-stone-950 p-6 text-white sm:min-h-[42vh] sm:p-10 lg:min-h-screen lg:p-14">
          {media.data?.loginVideoUrl && <video className="absolute inset-0 h-full w-full object-cover opacity-45" src={media.data.loginVideoUrl} autoPlay muted loop playsInline />}
          <div className="absolute inset-0 bg-gradient-to-br from-stone-950/90 via-stone-950/55 to-amber-950/65" />
          <div className="relative z-10 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ffc400] text-stone-900 shadow-lg"><Bike size={29} /></span>
            <div><p className="auth-brand-name">{APP_NAME}</p><p className="text-xs text-amber-100">{t("Community services")}</p></div>
          </div>
          <div className="relative z-10 my-8 max-w-xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200"><ShieldCheck size={15} /> {t("Community, connected")}</p>
            <h2 className="max-w-lg text-3xl font-black leading-tight sm:text-5xl">{t("A stronger connection to every community.")}</h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-stone-200 sm:text-base">{t("One secure place for citizen services, booth teams and local community work.")}</p>
          </div>
          <p className="relative z-10 hidden text-xs text-stone-300 lg:block">{t("Secure access · Verified teams · Community first")}</p>
        </section>
        <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-md">
            <div className="mb-4 flex justify-end">
              <label className="sr-only" htmlFor="auth-language">{t("Language")}</label>
              <select id="auth-language" value={language} onChange={(event) => setLanguage(event.target.value)} className="rounded-full border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600" aria-label={t("Language")}>
                <option value="en">{t("English")}</option>
                <option value="te">{t("తెలుగు")}</option>
              </select>
            </div>
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.15em] text-amber-700">{t("Welcome")}</p>
            <h1 className="text-3xl font-black tracking-tight text-stone-900">{t(title)}</h1>
            {subtitle && <p className="mb-6 mt-2 text-sm leading-6 text-slate-600">{t(subtitle)}</p>}
            {!subtitle && <p className="mb-6 mt-2 text-sm text-slate-600">{t("Create your account to get started.")}</p>}
            <div>{children}</div>
            <div className="mt-6 flex items-center justify-center gap-1 text-xs text-slate-500"><ShieldCheck size={14} className="text-emerald-700" /> {t("Secure sign in")} <ArrowRight size={12} /> {t("Your portal")}</div>
            {media.error && <p className="mt-3 text-center text-xs text-slate-400">{t("Login video is unavailable. You can still sign in.")}</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
