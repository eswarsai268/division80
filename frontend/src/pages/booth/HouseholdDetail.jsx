import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useState } from "react";
import Async from "../../components/Async";
import Empty from "../../components/Empty";
import ErrorBox from "../../components/ErrorBox";
import { patch } from "../../api/client";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";

export default function HouseholdDetail() {
    const { id } = useParams();
    const qc = useQueryClient();
    const q = useGet(["booth", "household", id], `/booth/households/${id}/citizens`);
    const visit = useMutation({
        mutationFn: ({ citizenId, ...data }) => patch(`/booth/citizens/${citizenId}/visit`, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["booth", "household", id] }),
    });
    const [drafts, setDrafts] = useState({});
    return <Async q={q}>{({ household, citizens }) => <div className="space-y-3">
    <div className="card"><h1 className="font-semibold">{t("House")} {household.houseCode}</h1><p className="mt-1 text-xs text-slate-500">{t("Booth")} {household.boothCode}{household.address ? ` · ${household.address}` : ""}</p><p className="mt-2 text-sm font-semibold text-emerald-700">{t("Visit progress")}: {citizens.filter((citizen) => citizen.verificationDone).length}/{citizens.length} {t("people visited")}</p></div>
    {!household.ownBooth && <div className="card bg-amber-50 text-sm text-amber-900">{t("Read-only access granted through a cross-booth approval.")}</div>}
    {visit.error && <ErrorBox error={visit.error}/>}
    {citizens.length === 0 && <Empty text="No family members on record."/>}
    {citizens.map((c) => {
      const saved = {
        lifeStatus: c.lifeStatus,
        verificationDone: Boolean(c.verificationDone),
        notHere: Boolean(c.notHere),
        addressChanged: Boolean(c.addressChanged),
        newAddress: c.newAddress ?? "",
        visitNotes: c.visitNotes ?? "",
      };
      const draft = drafts[c.id] ?? saved;
      const setDraft = (field, value) => setDrafts((current) => ({ ...current, [c.id]: { ...draft, [field]: value } }));
      return <div key={c.id} className="card space-y-3">
      <div><p className="font-medium">{t("Serial number")} {c.rollSerial ?? "—"} · {t("Door number")} {household.houseCode} · {c.fullName}</p><p className="text-xs text-slate-500">{c.relation} · {t("Voter ID")} {c.voterId ?? "—"} · {c.age ?? "—"} {t("years")} · {t(c.gender)}</p></div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.verificationDone} disabled={!household.ownBooth} onChange={(event) => setDraft("verificationDone", event.target.checked)}/>{t("Verification done")}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.lifeStatus === "DECEASED"} disabled={!household.ownBooth} onChange={(event) => setDraft("lifeStatus", event.target.checked ? "DECEASED" : "ALIVE")}/>{t("Dead")}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.notHere} disabled={!household.ownBooth} onChange={(event) => setDraft("notHere", event.target.checked)}/>{t("Not here")}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.addressChanged} disabled={!household.ownBooth} onChange={(event) => setDraft("addressChanged", event.target.checked)}/>{t("Address changed / shifted")}</label>
      </div>
      {draft.addressChanged && <label className="block text-sm">{t("New address")}<input className="input mt-1" maxLength={255} value={draft.newAddress} disabled={!household.ownBooth} placeholder={t("Enter changed address")} onChange={(event) => setDraft("newAddress", event.target.value)}/></label>}
      <label className="block text-sm">{t("Additional notes")}<textarea className="input mt-1 min-h-24" maxLength={1000} value={draft.visitNotes} disabled={!household.ownBooth} placeholder={t("Write any additional details for this person")} onChange={(event) => setDraft("visitNotes", event.target.value)}/></label>
      {household.ownBooth && <button className="btn w-full" disabled={visit.isPending || JSON.stringify(draft) === JSON.stringify(saved)} onClick={() => visit.mutate({ citizenId: c.id, ...draft })}>{t(visit.isPending ? "Saving…" : "Save visit details")}</button>}
      </div>;
    })}
    <p className="text-xs text-slate-500">{t("This checkbox saves the door-to-door visit. Official verification steps are in the Verifications page.")}</p>
  </div>}</Async>;
}
