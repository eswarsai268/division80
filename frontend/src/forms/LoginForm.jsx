import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { homeFor } from "../auth/paths";
import ErrorBox from "../components/ErrorBox";
import { fetchMe, login, logout } from "../services/authService";
import { PORTALS } from "../utils/constants";
import { loginSchema } from "./schemas";
import { isValidPhone, normalizePhone } from "../utils/phone";
import { t } from "../i18n";

/** One form, three portals. An account used on the wrong portal is signed out again. */
export default function LoginForm({ portal }) {
  const [showPassword, setShowPassword] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();
  const f = useForm({ resolver: zodResolver(loginSchema) });
  const submit = f.handleSubmit(async (v) => {
    const identifier = v.identifier.trim();
    const emailLogin = portal === "ADMIN" || identifier.includes("@");
    if (emailLogin && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      f.setError("identifier", { message: "Enter a valid email address" });
      return;
    }
    if (!emailLogin && !isValidPhone(identifier)) {
      f.setError("identifier", { message: "Enter a phone number with 8 to 15 digits" });
      return;
    }
    try {
      await login(emailLogin ? { email: identifier, password: v.password } : { phone: normalizePhone(identifier), password: v.password });
      const me = await fetchMe();
      if (me.role !== portal) { await logout().catch(() => undefined); f.setError("root", { message: `This sign-in page is for ${PORTALS[portal]} accounts. Use the correct login page.` }); return; }
      qc.setQueryData(["me"], me);
      nav(homeFor(me.role));
    } catch (e) { f.setError("root", { message: e.message }); }
  });
  return (
    <form onSubmit={submit} className="card space-y-4 rounded-2xl border-amber-200 p-5 shadow-lg shadow-amber-900/5">
      <div><label className="label" htmlFor="identifier">{portal === "ADMIN" ? t("Email address") : t("Phone number")}</label><input id="identifier" className="input min-h-12" type={portal === "ADMIN" ? "email" : "text"} inputMode={portal === "ADMIN" ? undefined : "tel"} autoComplete="username" placeholder={portal === "ADMIN" ? t("Enter the email given to you") : t("Phone number (existing booth email also works)")} {...f.register("identifier")} />{f.formState.errors.identifier && <p className="mt-1 text-xs text-red-600">{f.formState.errors.identifier.message}</p>}</div>
      <div><label className="label" htmlFor="pw">{t("Password")}</label><div className="relative"><input id="pw" className="input min-h-12 pr-12" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder={t("Enter your password")} {...f.register("password")} /><button type="button" className="password-visibility" onClick={() => setShowPassword((visible) => !visible)} aria-label={t(showPassword ? "Hide password" : "Show password")} aria-pressed={showPassword}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div></div>
      {f.formState.errors.root && <ErrorBox error={f.formState.errors.root} />}
      <button className="btn min-h-12 w-full rounded-xl py-3 text-base" disabled={f.formState.isSubmitting}>{t(f.formState.isSubmitting ? "Signing in…" : "Sign in")}</button>
    </form>
  );
}
