import { MessageCircle } from "lucide-react";
import ErrorBox from "./ErrorBox";
import { t } from "../i18n";

export default function VisitDetailsControls({ citizen, draft, setDraft, canEdit, pending, onSave, error }) {
  const disabled = !canEdit || Boolean(citizen.isFrozen);

  return <>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.verificationDone} disabled={disabled} onChange={(event) => setDraft("verificationDone", event.target.checked)}/>{t("Verification done")}</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.lifeStatus === "DECEASED"} disabled={disabled} onChange={(event) => setDraft("lifeStatus", event.target.checked ? "DECEASED" : "ALIVE")}/>{t("Dead")}</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.notHere} disabled={disabled} onChange={(event) => setDraft("notHere", event.target.checked)}/>{t("Not here")}</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.dFlag} disabled={disabled} onChange={(event) => setDraft("dFlag", event.target.checked)}/>{t("D")}</label>
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.addressChanged} disabled={disabled} onChange={(event) => setDraft("addressChanged", event.target.checked)}/>{t("Address changed / shifted")}</label>
        {citizen.whatsappPhone && <a className="no-print inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700" href={`https://wa.me/${citizen.whatsappPhone}`} target="_blank" rel="noopener noreferrer" aria-label={t("Open WhatsApp chat")} title={t("Open WhatsApp chat")}><MessageCircle size={20}/></a>}
      </div>
    </div>
    {draft.addressChanged && <label className="block text-sm">{t("New address")}<input className="input mt-1" maxLength={255} value={draft.newAddress} disabled={disabled} placeholder={t("Enter changed address")} onChange={(event) => setDraft("newAddress", event.target.value)}/></label>}
    <label className="block text-sm">{t("Additional notes")}<textarea className="input mt-1 min-h-24" maxLength={1000} value={draft.visitNotes} disabled={disabled} placeholder={t("Write any additional details for this person")} onChange={(event) => setDraft("visitNotes", event.target.value)}/></label>
    {error && <ErrorBox error={error}/>}
    {canEdit && !citizen.isFrozen && <button className="btn w-full" disabled={pending || !onSave} onClick={onSave}>{t(pending ? "Saving…" : "Save visit details")}</button>}
  </>;
}
