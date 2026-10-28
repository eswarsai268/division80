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
import { worksheetToCsv } from "../../utils/rosterWorkbook";

const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

export default function AdminImport() {
    const [uploadBody, setUploadBody] = useState(null);
    const [uploadBytes, setUploadBytes] = useState(0);
    const [fileName, setFile] = useState("");
    const [sheetName, setSheetName] = useState("");
    const [sheetNames, setSheetNames] = useState([]);
    const [fileError, setFileError] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const fileInput = useRef(null);
    const workbookRef = useRef(null);
    const jobs = useGet(["admin", "imports"], "/admin/import-jobs", { refetchInterval: 1000 });
    const [preview, setPreview] = useState(null);
    const create = useAct(() => api("/admin/import-jobs", {
        method: "POST",
        body: uploadBody,
        headers: { "Content-Type": "text/csv" },
    }).then((r) => setPreview(r)));
    const confirmM = useAct((id) => post(`/admin/import-jobs/${id}/confirm`).then(() => setPreview(null)));
    const deleteImport = useAct((id) => api(`/admin/import-jobs/${id}`, { method: "DELETE" }));
    const loadCsv = async (file) => {
        if (!file)
            return;
        setFile("");
        setUploadBody(null);
        setUploadBytes(0);
        setSheetName("");
        setSheetNames([]);
        workbookRef.current = null;
        setPreview(null);
        create.reset();
        const extension = file.name.toLowerCase().split(".").pop();
        if (extension !== "csv" && extension !== "xlsx") {
            setFileError(t("Choose a .csv or .xlsx file. Older .xls files, photos, and PDFs are not supported."));
            return;
        }
        if (file.size > MAX_IMPORT_BYTES) {
            setFileError(t("The selected file must be 50 MB or smaller."));
            return;
        }
        try {
            let contents;
            let nextWorkbook = null;
            let nextSheetNames = [];
            let nextSheetName = "";
            if (extension === "xlsx") {
                const { default: ExcelJS } = await import("exceljs");
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(await file.arrayBuffer());
                const sheets = workbook.worksheets.filter((sheet) => sheet.state === "visible");
                if (!sheets.length) {
                    setFileError(t("This Excel workbook has no visible worksheets."));
                    return;
                }
                const names = sheets.map((sheet) => sheet.name);
                const selectedSheet = sheets.find((sheet) => sheet.name.trim().toUpperCase() === "ALL") ?? sheets[0];
                contents = worksheetToCsv(selectedSheet);
                nextWorkbook = workbook;
                nextSheetNames = names;
                nextSheetName = selectedSheet.name;
            } else {
                setFile(file.name);
                setUploadBody(file);
                setUploadBytes(file.size);
                setSheetNames([]);
                setSheetName("");
                setPreview(null);
                setFileError("");
                create.reset();
                return;
            }
            if (!contents.trim()) {
                setFileError(t("This file or worksheet is empty. Choose one that contains roster rows."));
                return;
            }
            if (new Blob([contents]).size > MAX_IMPORT_BYTES) {
                setFileError(t("The selected worksheet is larger than 50 MB after reading. Choose a smaller worksheet."));
                return;
            }
            setFile(file.name);
            setUploadBody(contents);
            setUploadBytes(new Blob([contents]).size);
            setSheetNames(nextSheetNames);
            setSheetName(nextSheetName);
            workbookRef.current = nextWorkbook;
            setPreview(null);
            setFileError("");
            create.reset();
        } catch (error) {
            setFileError(t("Could not read this file. For Excel, use a valid .xlsx workbook; otherwise save it as .csv and try again."));
            console.error("Could not read selected roster file", error);
        }
    };
    const selectSheet = (name) => {
        const worksheet = workbookRef.current?.getWorksheet(name);
        if (!worksheet) {
            setFileError(t("Could not read the selected worksheet. Please choose the workbook again."));
            return;
        }
        const contents = worksheetToCsv(worksheet);
        if (!contents.trim()) {
            setFileError(t("This file or worksheet is empty. Choose one that contains roster rows."));
            return;
        }
        if (new Blob([contents]).size > MAX_IMPORT_BYTES) {
            setFileError(t("The selected worksheet is larger than 50 MB after reading. Choose a smaller worksheet."));
            return;
        }
        setSheetName(name);
        setUploadBody(contents);
        setUploadBytes(new Blob([contents]).size);
        setPreview(null);
        setFileError("");
        create.reset();
    };
    const clearFile = () => {
        setFile("");
        setUploadBody(null);
        setUploadBytes(0);
        setSheetName("");
        setSheetNames([]);
        workbookRef.current = null;
        setPreview(null);
        setFileError("");
        create.reset();
        if (fileInput.current)
            fileInput.current.value = "";
    };
    return <div className="space-y-3"><Title>{t("Import booth voter lists")}</Title>
    <div className="card space-y-4">
      <div><h2 className="font-semibold text-slate-900">{t("Add a voter list")}</h2><p className="mt-1 text-sm text-slate-600">{t("Upload a .xlsx Excel workbook or a .csv spreadsheet file. A photo or scanned voter-list page cannot be read here.")}</p></div>
      <ol className="space-y-1 rounded-xl bg-white/70 p-3 text-sm text-slate-700">
        <li><strong>1.</strong> {t("Download the sample CSV template.")}</li>
        <li><strong>2.</strong> {t("Fill in one person per row and enter the correct booth code.")}</li>
        <li><strong>3.</strong> {t("Choose your completed Excel or CSV file, then review it before importing.")}</li>
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
        <input ref={fileInput} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label={t("Choose Excel or CSV file")} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void loadCsv(file); }}/>
        {fileName
          ? <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><FileSpreadsheet size={22}/></span>
              <div className="min-w-0 flex-1"><p className="break-all text-sm font-semibold text-slate-900">{fileName}</p><p className="text-xs text-slate-500">{t("File selected")} · {(uploadBytes / (1024 * 1024)).toFixed(2)} MB</p></div>
              <button type="button" className="btn-ghost shrink-0" onClick={clearFile} aria-label={t("Remove selected file")}><X size={17}/><span className="hidden sm:inline">{t("Remove")}</span></button>
            </div>
          : <div className="flex flex-col items-center text-center">
              <span className="mb-2 grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-800"><UploadCloud size={25}/></span>
              <p className="font-semibold text-slate-900">{t("Choose your Excel or CSV file")}</p>
              <p className="mt-1 text-xs text-slate-600">{t("or drag and drop it here")} · {t("Excel .xlsx or CSV")} · {t("Maximum 50 MB")}</p>
              <button type="button" className="btn mt-3" onClick={() => fileInput.current?.click()}>{t("Choose Excel or CSV file")}</button>
            </div>}
      </div>
      {sheetNames.length > 1 && <label className="block space-y-1 text-sm"><span className="font-medium">{t("Worksheet to import")}</span><select className="input" value={sheetName} onChange={(event) => selectSheet(event.target.value)}>{sheetNames.map((name) => <option key={name} value={name}>{name}</option>)}</select><span className="block text-xs text-slate-500">{t("Only one worksheet is imported at a time. The ALL worksheet is selected by default when available.")}</span></label>}
      <p className="text-xs leading-5 text-slate-600">{t("Use one person per row. These screenshot-style headings are accepted:")} <code>SN, SERIAL NO, DOOR NO, NAME, VOTER ID, GENDER, BOOTH NO</code><br/>{t("Optional contact headings:")} <code>PHONE, MOBILE, PHONE NUMBER</code>. Phone numbers are stored as contacts owned by this import, independently of voter IDs. Invalid phone numbers are excluded from messaging without rejecting the roster row.<br/>{t("Optional visit headings:")} <code>VERIFICATION DONE, DEAD, NOT HERE, ADDRESS CHANGED, NEW ADDRESS, ADDITIONAL NOTES</code></p>
      <p className="text-xs leading-5 text-slate-500">{t("Printed voter photos are not imported. Maximum 50,000 rows. Formula-like values are stored as text and escaped in CSV exports.")}</p>
      {fileError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{fileError}</p>}
      {create.error && <ErrorBox error={create.error}/>}
      <button className="btn w-full" disabled={!uploadBody || create.isPending} onClick={() => create.mutate(undefined)}>{create.isPending ? t("Checking file…") : t("Check file before importing")}</button></div>
    {preview && <div className="card space-y-2"><h2 className="font-semibold">{t("Preview")}</h2>
      <p className="text-sm">{preview.totalRows} rows · <span className="text-green-700">{preview.validRows} changes ready</span> · <span className="text-slate-600">{preview.skippedRows} already present / repeated</span> · <span className="text-red-700">{preview.errorCount} errors</span></p>
      {(preview.phoneRows > 0 || preview.invalidPhoneRows > 0) && <p className="text-sm text-slate-700">Messaging contacts ready from this file: <strong>{preview.phoneRows}</strong>. Invalid phone numbers excluded: <strong>{preview.invalidPhoneRows ?? 0}</strong>. These contacts do not depend on voter ID matching.</p>}
      {preview.validRows > 0 ? <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{t("Confirm below to import the new roster rows and standalone messaging contacts. Deleting this import removes its phone numbers and any queued campaign copies.")}</p> : preview.skippedRows > 0 && preview.errorCount === 0 ? <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">All rows matched existing or repeated voter IDs. No roster changes are needed.</p> : <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">No valid roster rows or messaging contacts are ready to save.</p>}
      {preview.pendingBoothCodes?.length > 0 && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{preview.pendingBoothCodes.length} booth code(s) are not set up yet. They will be created when this import is saved. Create a member in Users or assign an existing member in Assignments. Codes: {preview.pendingBoothCodes.slice(0, 12).join(", ")}{preview.pendingBoothCodes.length > 12 ? "…" : ""}</p>}
      {preview.errors.length > 0 && <ul className="max-h-40 overflow-auto text-xs text-red-700">{preview.errors.map((e, i) => <li key={i}>{t("Line")} {e.line}: {e.message}</li>)}</ul>}
      {confirmM.error && <ErrorBox error={confirmM.error}/>}
      <button className="btn w-full" disabled={preview.validRows === 0 || confirmM.isPending} onClick={() => confirm(`Apply ${preview.validRows} roster changes? Invalid rows are skipped.`) && confirmM.mutate(preview.id)}>{confirmM.isPending ? t("Saving changes…") : <>{t("Apply roster changes")} ({preview.validRows})</>}</button></div>}
    <h2 className="font-semibold text-brand-900">{t("Recent imports")}</h2>
    {deleteImport.error && <ErrorBox error={deleteImport.error}/>}
    <Async q={jobs}>{(d) => d.length ? <>{d.map((j) => <div key={j.id} className="card mb-2 space-y-2 text-sm"><div className="flex justify-between"><span>{fmt(j.createdAt)}</span><Badge s={j.status}/></div><p className="text-xs text-slate-500">{j.validRows}/{j.totalRows} changes ready · {j.skippedRows} already present / repeated · {j.errorCount} {t("errors · processed")} {j.processedRows}{j.lastError ? ` · ${j.lastError}` : ""}</p>
      {j.status === "PREVIEW" && (j.validRows > 0 ? <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">{t("Not saved to the voter database yet. Apply the roster changes below to continue.")}</div> : j.skippedRows > 0 && j.errorCount === 0 ? <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-900">All rows matched existing or repeated voter IDs. No roster changes are needed.</div> : null)}
      {j.status === "QUEUED" && <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-950"><strong>{t("Save requested; waiting for the database worker.")}</strong><p>{t("The people are not in booth rosters until the worker saves them. Make sure the worker service is running and uses the same database settings as the API.")}</p></div>}
      {j.status === "COMMITTING" && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">{t("Saving people to the voter database. This page checks for updates automatically.")}</div>}
      {j.status === "COMMITTED" && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-900">{t("Saved into the database:")} {j.processedRows} {t("people")}. {t("Booth members assigned to the matching booth can now open these households.")}</div>}
      {j.status === "PREVIEW" && j.validRows > 0 && <button type="button" className="btn w-full" disabled={confirmM.isPending} onClick={() => confirm(`Apply ${j.validRows} roster changes? Invalid rows are skipped.`) && confirmM.mutate(j.id)}>{confirmM.isPending ? t("Saving changes…") : <>{t("Apply roster changes")} ({j.validRows})</>}</button>}
      {j.canDelete
        ? <button type="button" className="btn-ghost text-red-700" disabled={deleteImport.isPending} onClick={() => confirm(t("Permanently delete this import and its verification history? Empty booths and their assignments will be removed, and all current organization exports will expire. Shared roster records will be kept.")) && deleteImport.mutate(j.id)}>{t("Delete import")}</button>
        : (j.status === "COMMITTED" || j.status === "FAILED") && <p className="text-xs text-amber-800">{t("This older import cannot be safely deleted because its records were not linked to the import.")}</p>}
    </div>)}</> : <Empty text="No imports yet."/>}</Async></div>;
}
