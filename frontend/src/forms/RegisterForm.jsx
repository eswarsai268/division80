import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import ErrorBox from "../components/ErrorBox";
import { register } from "../services/authService";
import { registerSchema } from "./schemas";
import { t } from "../i18n";

export default function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const nav = useNavigate();
  const f = useForm({ resolver: zodResolver(registerSchema) });
  const submit = f.handleSubmit(async (v) => { try { await register(v); nav("/login"); } catch (e) { f.setError("root", { message: e.message }); } });
  const err = f.formState.errors;
  return (
    <form onSubmit={submit} className="card space-y-4 rounded-2xl border-amber-200 p-5 shadow-lg shadow-amber-900/5">
      <div><label className="label" htmlFor="n">{t("Full name")}</label><input id="n" className="input" {...f.register("fullName")} />{err.fullName && <p className="text-xs text-red-600">{err.fullName.message}</p>}</div>
      <div><label className="label" htmlFor="e">{t("Email")}</label><input id="e" className="input" type="email" {...f.register("email")} /></div>
     
<div>
  <label className="label" htmlFor="p">
    {t("Password")}
  </label>

  <div className="relative">
    <input
      id="p"
     className="input pr-10 password-input"
      type={showPassword ? "text" : "password"}
      autoComplete="new-password"
      {...f.register("password")}
    />

    <button
      type="button"
      onClick={() => setShowPassword((prev) => !prev)}
      className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center"
      aria-label={showPassword ? "Hide password" : "Show password"}
    >
      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
    </button>
  </div>

  {err.password && (
    <p className="text-xs text-red-600">
      {err.password.message}
    </p>
  )}
</div>


      {err.root && <ErrorBox error={err.root} />}
      <button className="btn w-full" disabled={f.formState.isSubmitting}>{t("Register")}</button>
    </form>
  );
}
