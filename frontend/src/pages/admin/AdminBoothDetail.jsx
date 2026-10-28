import { useParams } from "react-router-dom";
import { useState } from "react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import ErrorBox from "../../components/ErrorBox";
import { patch } from "../../api/client";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";

export default function AdminBoothDetail() {
    const { boothId } = useParams();
    const [name, setName] = useState("");
    const b = useGet(["admin", "booth", boothId], `/admin/booths/${boothId}`);
    const upd = useAct((body) => patch(`/admin/booths/${boothId}`, body));
    return <div className="space-y-3"><Async q={b}>{(d) => <>
    <div className="card space-y-2"><div className="flex justify-between"><h1 className="font-semibold">{d.code} — {d.name}</h1><Badge s={d.status}/></div><p className="text-sm text-slate-600">{d.households} households</p>
      <div className="flex gap-2"><input className="input" placeholder={t("Rename booth")} value={name} onChange={(e) => setName(e.target.value)} aria-label={t("New booth name")}/><button className="btn-ghost" disabled={name.length < 2} onClick={() => upd.mutate({ name })}>{t("Rename")}</button></div>
      {upd.error && <ErrorBox error={upd.error}/>}
      <button className="btn-ghost w-full" disabled={upd.isPending} onClick={() => confirm(d.status === "ACTIVE" ? "Deactivate this booth? Members lose access immediately." : "Activate booth?") && upd.mutate({ status: d.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}>{d.status === "ACTIVE" ? "Deactivate booth" : "Activate booth"}</button></div></>}</Async></div>;
}
