import { useRef, useState } from "react";
import { FileSpreadsheet, UploadCloud, X } from "lucide-react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import ErrorBox from "../../components/ErrorBox";
import Title from "../../components/Title";
import { IMPORT_TEMPLATE } from "../../utils/constants";
import { fmt } from "../../utils/format";
import { api, post } from "../../api/client";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";

const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

export default function AdminImport() {
    const [csv, setCsv] = useState("");
    const [fileName, setFile] = useState("");
    const [fileError, setFileError] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const fileInput = useRef(null);
    const jobs = useGet(["admin", "imports"], "/admin/import-jobs", { refetchInterval: 4000 });
    const [preview, setPreview] = useState(null);
    const create = useAct(() => post("/admin/import-jobs", { csv }).then((r) => setPreview(r)));
    const confirmM = useAct((id) => post(`/admin/import-jobs/${id}/confirm`).then(() => setPreview(null)));
    const deleteImport = useAct((id) => api(`/admin/import-jobs/${id}`, { method: "DELETE" }));
    const loadCsv = async (file) => {
        if (!file)
            return;
        setFile("");
        setCsv("");
        setPreview(null);
        create.reset();
        if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
            setFileError(t("Choose a .csv file. Photos and PDFs cannot be uploaded here."));
            return;
        }
        if (file.size > MAX_IMPORT_BYTES) {
            setFileError(t("The CSV file must be 50 MB or smaller."));
            return;
        }
        try {
            const contents = await file.text();
            if (!contents.trim()) {
                setFileError(t("This CSV file is empty. Choose a file that contains roster rows."));
                return;
            }
            setFile(file.name);
            setCsv(contents);
            setPreview(null);
            setFileError("");
            create.reset();
        } catch (error) {
            setFileError(t("Could not read this file. Please choose the CSV file again."));
            console.error("Could not read selected roster CSV", error);
        }
    };
    const clearFile = () => {
        setFile("");
        setCsv("");
        setPreview(null);
        setFileError("");
        create.reset();
        if (fileInput.current)
            fileInput.current.value = "";
    };
    return <div className="space-y-3"><Title>{t("Import booth voter lists")}</Title>
    <div className="card space-y-4">
      <div><h2 className="font-semibold text-slate-900">{t("Add a voter list")}</h2><p className="mt-1 text-sm text-slate-600">{t("Use a CSV spreadsheet file. A photo or scanned voter-list page cannot be read here.")}</p></div>
      <ol className="space-y-1 rounded-xl bg-white/70 p-3 text-sm text-slate-700">
        <li><strong>1.</strong> {t("Download the sample CSV template.")}</li>
        <li><strong>2.</strong> {t("Fill in one person per row and enter the correct booth code.")}</li>
        <li><strong>3.</strong> {t("Choose your completed CSV file, then review it before importing.")}</li>
      </ol>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" className="btn-ghost justify-center" onClick={() => { const u = URL.createObjectURL(new Blob([IMPORT_TEMPLATE], { type: "text/csv" })); const a = document.createElement("a"); a.href = u; a.download = "import-template.csv"; a.click(); URL.revokeObjectURL(u); }}>{t("Download template")}</button>
      </div>
      <div
        className={`rounded-2xl border-2 border-dashed p-4 transition-colors sm:p-5 ${isDragging ? "border-amber-600 bg-amber-100" : "border-amber-400 bg-white/70 hover:bg-white"}`}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setIsDragging(false); void loadCsv(event.dataTransfer.files?.[0]); }}
      >
        <input ref={fileInput} type="file" accept=".csv,text/csv" aria-label={t("Choose CSV file")} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void loadCsv(file); }}/>
        {fileName
          ? <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><FileSpreadsheet size={22}/></span>
              <div className="min-w-0 flex-1"><p className="break-all text-sm font-semibold text-slate-900">{fileName}</p><p className="text-xs text-slate-500">{t("CSV file selected")} · {csv.length.toLocaleString()} {t("characters")}</p></div>
              <button type="button" className="btn-ghost shrink-0" onClick={clearFile} aria-label={t("Remove selected file")}><X size={17}/><span className="hidden sm:inline">{t("Remove")}</span></button>
            </div>
          : <div className="flex flex-col items-center text-center">
              <span className="mb-2 grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-800"><UploadCloud size={25}/></span>
              <p className="font-semibold text-slate-900">{t("Choose your CSV file")}</p>
              <p className="mt-1 text-xs text-slate-600">{t("or drag and drop it here")} · {t("CSV only")} · {t("Maximum 50 MB")}</p>
              <button type="button" className="btn mt-3" onClick={() => fileInput.current?.click()}>{t("Choose CSV file")}</button>
            </div>}
      </div>
      <p className="text-xs leading-5 text-slate-600">{t("Use one person per row. These screenshot-style headings are accepted:")} <code>SN, SERIAL NO, DOOR NO, NAME, VOTER ID, GENDER, BOOTH NO</code><br/>{t("Optional visit headings:")} <code>VERIFICATION DONE, DEAD, NOT HERE, ADDRESS CHANGED, NEW ADDRESS, ADDITIONAL NOTES</code></p>
      <p className="text-xs leading-5 text-slate-500">{t("Printed voter photos are not imported. Maximum 50,000 rows; formula cells are rejected.")}</p>
      {fileError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{fileError}</p>}
      {create.error && <ErrorBox error={create.error}/>}
      <button className="btn w-full" disabled={!csv || create.isPending} onClick={() => create.mutate(undefined)}>{create.isPending ? t("Checking CSV…") : t("Check file before importing")}</button></div>
    {preview && <div className="card space-y-2"><h2 className="font-semibold">{t("Preview")}</h2>
      <p className="text-sm">{preview.totalRows} rows · <span className="text-green-700">{preview.validRows} valid</span> · <span className="text-red-700">{preview.errorCount} errors</span></p>
      {preview.errors.length > 0 && <ul className="max-h-40 overflow-auto text-xs text-red-700">{preview.errors.map((e, i) => <li key={i}>{t("Line")} {e.line}: {e.message}</li>)}</ul>}
      {confirmM.error && <ErrorBox error={confirmM.error}/>}
      <button className="btn w-full" disabled={preview.validRows === 0 || confirmM.isPending} onClick={() => confirm(`Import ${preview.validRows} valid rows? Invalid rows are skipped.`) && confirmM.mutate(preview.id)}>Confirm import ({preview.validRows} rows)</button></div>}
    <h2 className="font-semibold text-brand-900">{t("Recent imports")}</h2>
    {deleteImport.error && <ErrorBox error={deleteImport.error}/>}
    <Async q={jobs}>{(d) => d.length ? <>{d.map((j) => <div key={j.id} className="card mb-2 space-y-2 text-sm"><div className="flex justify-between"><span>{fmt(j.createdAt)}</span><Badge s={j.status}/></div><p className="text-xs text-slate-500">{j.validRows}/{j.totalRows} valid · {j.errorCount} {t("errors · processed")} {j.processedRows}{j.lastError ? ` · ${j.lastError}` : ""}</p>
      {j.status === "QUEUED" && <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-950"><strong>{t("Upload accepted; waiting for the background worker.")}</strong><p>{t("The booth roster will appear only after the worker processes this job. In production, start the worker service using:")} <code className="break-all">node worker/src/index.js</code></p><p>{t("Make sure the worker uses the same database settings as the API.")}</p></div>}
      {j.status === "COMMITTING" && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">{t("The worker is importing these rows. This page checks for updates automatically.")}</div>}
      {j.status === "COMMITTED" && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-900">{t("Import finished. Booth members assigned to the matching booth can now open these households.")}</div>}
      {j.canDelete
        ? <button type="button" className="btn-ghost text-red-700" disabled={deleteImport.isPending} onClick={() => confirm(t("Delete this import and archive the roster records created by it? Verification history will be kept.")) && deleteImport.mutate(j.id)}>{t("Delete import")}</button>
        : (j.status === "COMMITTED" || j.status === "FAILED") && <p className="text-xs text-amber-800">{t("This older import cannot be safely deleted because its records were not linked to the import.")}</p>}
    </div>)}</> : <Empty text="No imports yet."/>}</Async></div>;
}
