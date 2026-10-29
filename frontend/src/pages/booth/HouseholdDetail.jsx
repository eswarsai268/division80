import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useState } from "react";
import { flushSync } from "react-dom";
import { MessageCircle, Printer } from "lucide-react";
import Async from "../../components/Async";
import Empty from "../../components/Empty";
import ErrorBox from "../../components/ErrorBox";
import { api, patch } from "../../api/client";
import { findOfflineHousehold, isOfflineFallbackError, readOfflineRoster } from "../../services/offlineRoster";
import { useMe } from "../../auth/useMe";
import { getPairedThermalPrinters, getVoterSlipContent, isAndroidNative, openBluetoothSettings, printVoterSlips } from "../../services/thermalPrinter";
import { t } from "../../i18n";

export default function HouseholdDetail() {
    const { id } = useParams();
    const { data: me } = useMe();
    const qc = useQueryClient();
    const q = useQuery({
        queryKey: ["booth", "household", id],
        queryFn: async ({ signal }) => {
            if (me?.isOffline || !navigator.onLine) {
                const cached = await readOfflineRoster();
                const record = cached && findOfflineHousehold(cached, id);
                if (!record) throw new Error("This household is not available in the offline roster saved on this device.");
                const { citizens, ...household } = record;
                return { household: { ...household, offline: true }, citizens };
            }
            try {
                return await api(`/booth/households/${id}/citizens`, { signal });
            } catch (error) {
                if (!isOfflineFallbackError(error)) throw error;
                const cached = await readOfflineRoster();
                const record = cached && findOfflineHousehold(cached, id);
                if (!record) throw error;
                const { citizens, ...household } = record;
                return { household: { ...household, offline: true }, citizens };
            }
        },
    });
    const visit = useMutation({
        mutationFn: ({ citizenId, ...data }) => patch(`/booth/citizens/${citizenId}/visit`, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["booth", "household", id] }),
    });
    const [drafts, setDrafts] = useState({});
    const [selectedIds, setSelectedIds] = useState([]);
    const [printRecords, setPrintRecords] = useState([]);
    const [pendingPrintRecords, setPendingPrintRecords] = useState([]);
    const [printerDialogOpen, setPrinterDialogOpen] = useState(false);
    const [pairedPrinters, setPairedPrinters] = useState([]);
    const [selectedPrinterAddress, setSelectedPrinterAddress] = useState("");
    const [printerLoading, setPrinterLoading] = useState(false);
    const [printerPrinting, setPrinterPrinting] = useState(false);
    const [printerError, setPrinterError] = useState("");
    const [printNotice, setPrintNotice] = useState("");
    const refreshPairedPrinters = async () => {
        setPrinterLoading(true);
        setPrinterError("");
        try {
            const devices = await getPairedThermalPrinters();
            setPairedPrinters(devices);
            setSelectedPrinterAddress((current) => devices.some((device) => device.address === current) ? current : "");
        } catch (error) {
            setPrinterError(error?.message || "Could not load paired Bluetooth devices.");
        } finally {
            setPrinterLoading(false);
        }
    };
    const printRecordsNow = (records) => {
        const verifiedRecords = records.filter((record) => Boolean(record?.verificationDone));
        if (!verifiedRecords.length) return;
        setPrintNotice("");
        flushSync(() => setPrintRecords(verifiedRecords));
        if (isAndroidNative()) {
            setPendingPrintRecords(verifiedRecords);
            setPrinterDialogOpen(true);
            refreshPairedPrinters();
        } else {
            window.print();
        }
    };
    const sendToBluetoothPrinter = async () => {
        if (!selectedPrinterAddress || !pendingPrintRecords.length) return;
        setPrinterPrinting(true);
        setPrinterError("");
        try {
            await printVoterSlips(selectedPrinterAddress, pendingPrintRecords, household);
            setPrinterDialogOpen(false);
            setPrintNotice(t("Print job sent to the printer."));
        } catch (error) {
            setPrinterError(error?.message || t("Could not print. Check the printer connection and try again."));
        } finally {
            setPrinterPrinting(false);
        }
    };
    const useSystemPrint = () => {
        setPrinterDialogOpen(false);
        window.print();
    };
    return <Async q={q}>{({ household, citizens }) => {
    const canEdit = household.ownBooth && !household.offline && navigator.onLine;
    return <div className="space-y-3">
    <div className="card"><h1 className="font-semibold">{t("House")} {household.houseCode}</h1><p className="mt-1 text-xs text-slate-500">{t("Booth")} {household.boothCode}{household.address ? ` · ${household.address}` : ""}</p><p className="mt-2 text-sm font-semibold text-emerald-700">{t("Visit progress")}: {citizens.filter((citizen) => citizen.verificationDone).length}/{citizens.length} {t("people visited")}</p></div>
    {household.offline && <div className="card bg-amber-50 text-sm text-amber-900">Offline copy: printing verified records is available; visit updates require internet.</div>}
    {!household.ownBooth && <div className="card bg-amber-50 text-sm text-amber-900">{t("Read-only view. Visit updates are available only for your assigned booths.")}</div>}
    {visit.error && <ErrorBox error={visit.error}/>}
    <section className="no-print sticky top-2 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-white p-3 shadow-md">
      <label className="flex min-h-10 items-center gap-2 text-sm font-semibold"><input type="checkbox" disabled={!citizens.some((c) => Boolean(c.verificationDone))} checked={citizens.some((c) => Boolean(c.verificationDone)) && citizens.filter((c) => Boolean(c.verificationDone)).every((c) => selectedIds.includes(c.id))} onChange={(event) => setSelectedIds(event.target.checked ? citizens.filter((c) => Boolean(c.verificationDone)).map((c) => c.id) : [])}/>{t("Select all verified")}</label>
      <button type="button" className="btn inline-flex min-h-10 items-center gap-2" disabled={!selectedIds.some((id) => citizens.some((c) => c.id === id && c.verificationDone))} onClick={() => printRecordsNow(citizens.filter((c) => selectedIds.includes(c.id) && c.verificationDone))}><Printer size={17}/>{t("Print selected")}</button>
      <p className="w-full text-xs text-slate-500" aria-live="polite">{selectedIds.filter((selectedId) => citizens.some((citizen) => citizen.id === selectedId && Boolean(citizen.verificationDone))).length > 0 ? <>{selectedIds.filter((selectedId) => citizens.some((citizen) => citizen.id === selectedId && Boolean(citizen.verificationDone))).length} {t("verified records selected")}</> : <>{t("No saved verified records yet. Check Verification done on a person and save the visit details before selecting records to print.")}</>}</p>
    </section>
    {citizens.length === 0 && <Empty text="No family members on record."/>}
    {printNotice && <p role="status" className="no-print rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{printNotice}</p>}
    {citizens.map((c) => {
      const saved = {
        lifeStatus: c.lifeStatus,
        verificationDone: Boolean(c.verificationDone),
        notHere: Boolean(c.notHere),
        addressChanged: Boolean(c.addressChanged),
        dFlag: Boolean(c.dFlag),
        newAddress: c.newAddress ?? "",
        visitNotes: c.visitNotes ?? "",
      };
      const draft = drafts[c.id] ?? saved;
      const setDraft = (field, value) => setDrafts((current) => ({ ...current, [c.id]: { ...draft, [field]: value } }));
      return <div key={c.id} className="card space-y-3">
      <label className={`no-print flex min-h-11 items-center gap-2 rounded-lg bg-emerald-50 px-3 text-sm font-semibold text-emerald-900 ${c.verificationDone ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}><input className="h-5 w-5 shrink-0 accent-emerald-700" type="checkbox" disabled={!Boolean(c.verificationDone)} title={!c.verificationDone ? t("Save Verification done before selecting this record.") : undefined} checked={selectedIds.includes(c.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...new Set([...current, c.id])] : current.filter((id) => id !== c.id))}/>{t("Select verified record for printing")}</label>
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <div><dt className="text-xs font-medium text-slate-500">{t("S.No.")}</dt><dd className="mt-0.5 text-lg font-bold text-slate-900">{c.rollSerial ?? "—"}</dd></div>
          <div className="col-span-2 sm:col-span-2"><dt className="text-xs font-medium text-slate-500">{t("Name")}</dt><dd className="mt-0.5 break-words text-lg font-bold text-slate-900">{c.fullName}{c.verificationDone && <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">{t("Verified")}</span>}</dd></div>
          <div><dt className="text-xs font-medium text-slate-500">{t("Father / husband")}</dt><dd className="mt-0.5 break-words text-base font-semibold text-slate-900">{c.fatherOrHusbandName || "—"}</dd></div>
          <div><dt className="text-xs font-medium text-slate-500">{t("Door number")}</dt><dd className="mt-0.5 text-base font-semibold text-slate-900">{household.houseCode}</dd></div>
<div><dt className="text-xs font-medium text-slate-500">{t("Voter ID")}</dt><dd className="mt-0.5 flex flex-wrap items-center gap-2 break-all text-lg font-bold text-slate-900"><span>{c.voterId ?? "�"}</span><a href={`/slips/voter/${c.id}`} target="_blank" rel="noopener noreferrer" className="no-print inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700">{t("Print slip")}</a><button type="button" disabled={!c.verificationDone} className="no-print inline-flex min-h-8 items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 text-xs font-semibold text-amber-900 disabled:opacity-50" onClick={() => printRecordsNow([c])}><Printer size={14}/>{c.verificationDone ? t("Print") : t("After verification")}</button></dd></div>
          <div><dt className="text-xs font-medium text-slate-500">{t("Booth number")}</dt><dd className="mt-0.5 text-base font-semibold text-slate-900">{household.boothCode}</dd></div>
          <div className="col-span-2 sm:col-span-3"><dt className="text-xs font-medium text-slate-500">{t("Polling station")}</dt><dd className="mt-0.5 text-base font-semibold text-slate-900">{c.pollingStation || t("Not available")}</dd></div>
          <div className="col-span-2 sm:col-span-3"><dt className="text-xs font-medium text-slate-500">{t("Polling address")}</dt><dd className="mt-0.5 break-words text-base font-semibold text-slate-900">{c.pollingAddress || t("Not available")}</dd></div>
        </dl>
        <p className="mt-3 border-t border-amber-200 pt-2 text-sm text-slate-600">{t(c.relation)} · {c.age ?? "—"} {t("years")} · {t(c.gender)}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.verificationDone} disabled={!canEdit} onChange={(event) => setDraft("verificationDone", event.target.checked)}/>{t("Verification done")}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.lifeStatus === "DECEASED"} disabled={!canEdit} onChange={(event) => setDraft("lifeStatus", event.target.checked ? "DECEASED" : "ALIVE")}/>{t("Dead")}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.notHere} disabled={!canEdit} onChange={(event) => setDraft("notHere", event.target.checked)}/>{t("Not here")}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.dFlag} disabled={!canEdit} onChange={(event) => setDraft("dFlag", event.target.checked)}/>{t("D")}</label>
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.addressChanged} disabled={!canEdit} onChange={(event) => setDraft("addressChanged", event.target.checked)}/>{t("Address changed / shifted")}</label>
          {c.whatsappPhone && <a className="no-print inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700" href={`https://wa.me/${c.whatsappPhone}`} target="_blank" rel="noopener noreferrer" aria-label={t("Open WhatsApp chat")} title={t("Open WhatsApp chat")}><MessageCircle size={20}/></a>}
        </div>
      </div>
      {draft.addressChanged && <label className="block text-sm">{t("New address")}<input className="input mt-1" maxLength={255} value={draft.newAddress} disabled={!canEdit} placeholder={t("Enter changed address")} onChange={(event) => setDraft("newAddress", event.target.value)}/></label>}
      <label className="block text-sm">{t("Additional notes")}<textarea className="input mt-1 min-h-24" maxLength={1000} value={draft.visitNotes} disabled={!canEdit} placeholder={t("Write any additional details for this person")} onChange={(event) => setDraft("visitNotes", event.target.value)}/></label>
      {canEdit && <button className="btn w-full" disabled={visit.isPending || JSON.stringify(draft) === JSON.stringify(saved)} onClick={() => visit.mutate({ citizenId: c.id, ...draft })}>{t(visit.isPending ? "Saving…" : "Save visit details")}</button>}
      </div>;
    })}
    {printerDialogOpen && <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !printerPrinting) setPrinterDialogOpen(false); }}>
      <section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="printer-dialog-title">
        <h2 id="printer-dialog-title" className="text-lg font-bold">{t("Print voter slips")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("Choose the printer you paired. Other Bluetooth devices may also be listed. You can also use the phone's print and PDF options.")}</p>
        <p className="mt-2 text-xs text-slate-500">{t("Direct Bluetooth printing requires an ESC/POS printer with Bluetooth Classic support.")}</p>
        {printerError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{printerError}</p>}
        {printerLoading ? <p className="mt-4 text-sm" aria-live="polite">{t("Loading paired devices…")}</p> : pairedPrinters.length ? <label className="mt-4 block text-sm font-medium">{t("Paired Bluetooth devices")}
          <select className="input mt-1" value={selectedPrinterAddress} onChange={(event) => setSelectedPrinterAddress(event.target.value)}>
            <option value="">{t("Select a printer")}</option>
            {pairedPrinters.map((device) => <option key={device.address} value={device.address}>{device.name} (…{device.address.slice(-5)})</option>)}
          </select>
        </label> : <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t("No paired devices found. Pair the printer in Bluetooth settings, then refresh this list.")}</p>}
        <div className="mt-5 grid gap-2">
          <button type="button" className="btn w-full" disabled={!selectedPrinterAddress || printerLoading || printerPrinting} onClick={sendToBluetoothPrinter}>{printerPrinting ? t("Sending print job…") : t("Print to Bluetooth printer")}</button>
          <button type="button" className="btn-ghost w-full" disabled={printerLoading || printerPrinting} onClick={async () => { setPrinterError(""); try { await openBluetoothSettings(); } catch (error) { setPrinterError(error?.message || t("Could not open Bluetooth settings.")); } }}>{t("Pair or manage Bluetooth devices")}</button>
          <button type="button" className="btn-ghost w-full" disabled={printerPrinting} onClick={refreshPairedPrinters}>{t("Refresh paired devices")}</button>
          <button type="button" className="btn-ghost w-full" disabled={printerPrinting} onClick={useSystemPrint}>{t("Use system print / Save as PDF")}</button>
          <button type="button" className="min-h-10 rounded-lg px-3 text-sm font-semibold text-slate-600" disabled={printerPrinting} onClick={() => setPrinterDialogOpen(false)}>{t("Cancel")}</button>
        </div>
      </section>
    </div>}
    <section className="print-only"><h1>VOTER DETAILS</h1>{printRecords.map((c) => {
      const content = getVoterSlipContent(c, household);
      return <article className="voter-slip" key={c.id}>
        {content.fields.map((field) => <div className="voter-slip-row" key={field.label}><span>{field.label}</span><strong>{field.value}</strong></div>)}
        <p className="voter-slip-summary">{content.summary.map((item) => t(item)).join(" · ")}</p>
      </article>;
    })}</section>
    <p className="text-xs text-slate-500">{t("This checkbox saves the door-to-door visit. Official verification steps are in the Verifications page.")}</p>
  </div>; }}</Async>;
}
