import { useState } from "react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import ErrorBox from "../../components/ErrorBox";
import Title from "../../components/Title";
import { patch, post } from "../../api/client";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";
import { isValidPhone, normalizePhone } from "../../utils/phone";
import { t } from "../../i18n";

export default function AdminUsers() {
  const [f, setF] = useState({ phone: "", fullName: "", password: "" });
  const [createdPhone, setCreatedPhone] = useState("");
  const q = useGet(["admin", "users"], "/admin/users");
  const create = useAct(() => post("/admin/users", { ...f, role: "BOOTH_MEMBER", phone: normalizePhone(f.phone), fullName: f.fullName.trim() }).then((result) => {
    setCreatedPhone(normalizePhone(f.phone));
    setF({ phone: "", fullName: "", password: "" });
    return result;
  }));
  const upd = useAct((v) => patch(`/admin/users/${v.id}`, { status: v.status }));
  return <div className="space-y-3"><Title>{t("Users")}</Title>
    <div className="card space-y-2"><h2 className="font-semibold">{t("Create booth member")}</h2>
      <input className="input" placeholder={t("Full name")} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} aria-label={t("Full name")}/>
      <input className="input" type="tel" autoComplete="tel" placeholder={t("Phone number")} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} aria-label={t("Phone number")}/>
      <input className="input" type="password" minLength={4} placeholder={t("Initial password (4+ characters)")} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} aria-label={t("Initial password")} autoComplete="new-password"/>
      {(create.error || upd.error) && <ErrorBox error={create.error ?? upd.error}/>}
      {create.isSuccess && <p role="status" className="text-sm text-emerald-700">{`Member ${createdPhone} created. Assign them to a booth from Assignments.`}</p>}
      <button className="btn w-full" disabled={create.isPending || f.password.length < 4 || !isValidPhone(f.phone) || f.fullName.trim().length < 2} onClick={() => create.mutate(undefined)}>{create.isPending ? "Creating..." : "Create booth member"}</button>
    </div>
    <Async q={q}>{(d) => <>{d.map((u) => <div key={u.id} className="card mb-2 flex items-center justify-between text-sm"><div><p className="font-medium">{u.fullName}</p><p className="text-xs text-slate-500">{u.phone || u.email || "No phone number"} - {String(u.role).replace("_", " ")}</p></div><div className="flex items-center gap-2"><Badge s={u.status}/>{u.role !== "ADMIN" && <button className="btn-ghost" onClick={() => confirm(u.status === "ACTIVE" ? "Suspend this account?" : "Reactivate?") && upd.mutate({ id: u.id, status: u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })}>{u.status === "ACTIVE" ? "Suspend" : "Activate"}</button>}</div></div>)}</>}</Async>
  </div>;
}
