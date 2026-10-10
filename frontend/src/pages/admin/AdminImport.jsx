import { useState } from "react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import ErrorBox from "../../components/ErrorBox";
import Title from "../../components/Title";
import { IMPORT_TEMPLATE } from "../../utils/constants";
import { fmt } from "../../utils/format";
import { post } from "../../api/client";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";

export default function AdminImport() {
    const [csv, setCsv] = useState("");
    const [fileName, setFile] = useState("");
    const jobs = useGet(["admin", "imports"], "/admin/import-jobs", { refetchInterval: 4000 });
    const [preview, setPreview] = useState(null);
    const create = useAct(() => post("/admin/import-jobs", { csv }).then((r) => setPreview(r)));
    const confirmM = useAct((id) => post(`/admin/import-jobs/${id}/confirm`).then(() => setPreview(null)));
    return <div className="space-y-3"><Title>Import booth voter lists</Title>
    <div className="card space-y-2"><p className="text-sm text-slate-600">Upload one roster containing all booth members and voter records. Booth members will only see people assigned to their active booths. Required columns: <code>booth_code, house_code, full_name, relation</code>. Optional: <code>voter_id, life_status</code>. Max 50,000 rows. Cells starting with = + - @ are rejected.</p>
      <button className="btn-ghost" onClick={() => { const u = URL.createObjectURL(new Blob([IMPORT_TEMPLATE], { type: "text/csv" })); const a = document.createElement("a"); a.href = u; a.download = "import-template.csv"; a.click(); URL.revokeObjectURL(u); }}>Download template</button>
      <input type="file" accept=".csv,text/csv" aria-label="CSV file" className="text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) {
        setFile(f.name);
        setCsv(await f.text());
        setPreview(null);
    } }}/>
      {fileName && <p className="text-xs text-slate-500">{fileName} · {csv.length.toLocaleString()} characters</p>}
      {create.error && <ErrorBox error={create.error}/>}
      <button className="btn w-full" disabled={!csv || create.isPending} onClick={() => create.mutate(undefined)}>Validate & preview</button></div>
    {preview && <div className="card space-y-2"><h2 className="font-semibold">Preview</h2>
      <p className="text-sm">{preview.totalRows} rows · <span className="text-green-700">{preview.validRows} valid</span> · <span className="text-red-700">{preview.errorCount} errors</span></p>
      {preview.errors.length > 0 && <ul className="max-h-40 overflow-auto text-xs text-red-700">{preview.errors.map((e, i) => <li key={i}>Line {e.line}: {e.message}</li>)}</ul>}
      {confirmM.error && <ErrorBox error={confirmM.error}/>}
      <button className="btn w-full" disabled={preview.validRows === 0 || confirmM.isPending} onClick={() => confirm(`Import ${preview.validRows} valid rows? Invalid rows are skipped.`) && confirmM.mutate(preview.id)}>Confirm import ({preview.validRows} rows)</button></div>}
    <h2 className="font-semibold text-brand-900">Recent imports</h2>
    <Async q={jobs}>{(d) => d.length ? <>{d.map((j) => <div key={j.id} className="card mb-2 text-sm"><div className="flex justify-between"><span>{fmt(j.createdAt)}</span><Badge s={j.status}/></div><p className="text-xs text-slate-500">{j.validRows}/{j.totalRows} valid · {j.errorCount} errors · processed {j.processedRows}{j.lastError ? ` · ${j.lastError}` : ""}</p></div>)}</> : <Empty text="No imports yet."/>}</Async></div>;
}
