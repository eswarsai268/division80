import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { homeFor } from "../auth/paths";
import ErrorBox from "../components/ErrorBox";
import { fetchMe, login, logout } from "../services/authService";
import { PORTALS } from "../utils/constants";
import { loginSchema } from "./schemas";

/** One form, three portals. An account used on the wrong portal is signed out again. */
export default function LoginForm({ portal }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const f = useForm({ resolver: zodResolver(loginSchema) });
  const submit = f.handleSubmit(async (v) => {
    try {
      await login(v);
      const me = await fetchMe();
      if (me.role !== portal) { await logout().catch(() => undefined); f.setError("root", { message: `This sign-in page is for ${PORTALS[portal]} accounts. Use the correct login page.` }); return; }
      qc.setQueryData(["me"], me);
      nav(homeFor(me.role));
    } catch (e) { f.setError("root", { message: e.message }); }
  });
  return (
    <form onSubmit={submit} className="card space-y-4 rounded-2xl border-amber-200 p-5 shadow-lg shadow-amber-900/5">
      <div><label className="label" htmlFor="email">Email</label><input id="email" className="input" type="email" autoComplete="username" {...f.register("email")} />{f.formState.errors.email && <p className="text-xs text-red-600">{f.formState.errors.email.message}</p>}</div>
      <div><label className="label" htmlFor="pw">Password</label><input id="pw" className="input" type="password" autoComplete="current-password" {...f.register("password")} /></div>
      {f.formState.errors.root && <ErrorBox error={f.formState.errors.root} />}
      <button className="btn w-full rounded-xl py-3 text-base" disabled={f.formState.isSubmitting}>{f.formState.isSubmitting ? "Signing in…" : "Sign in to MyTDP"}</button>
    </form>
  );
}
