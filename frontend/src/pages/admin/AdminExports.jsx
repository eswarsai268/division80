import { useState } from "react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import ErrorBox from "../../components/ErrorBox";
import Title from "../../components/Title";
import { download, post } from "../../api/client";
import { fmt } from "../../utils/format";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";

const EXPORT_LABELS = {
    PENDING_VERIFICATION: "Pending verification (no steps passed)",
    IN_PROGRESS_VERIFICATION: "In progress (1–5 steps passed)",
    VERIFIED_CITIZENS: "Fully verified (6 steps passed)",
};

export default function AdminExports() {
    const [kind, setKind] = useState("PENDING_VERIFICATION");
    const [boothId, setBooth] = useState("");
    const jobs = useGet(["admin", "exports"], "/admin/export-jobs", { refetchInterval: 4000 });
    const booths = useGet(["admin", "booths"], "/admin/booths");
    const create = useAct(() => post("/admin/export-jobs", { kind, ...(boothId ? { boothId } : {}) }));
    const [dlErr, setDlErr] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const startDownload = async (job) => {
      setDlErr(null);
      setDownloadingId(job.id);
      try {
        await download(`/admin/export-jobs/${job.id}/download`, `export-${job.kind.toLowerCase()}.csv`);
      } catch (error) {
        setDlErr(error);
      } finally {
        setDownloadingId(null);
      }
    };
    return <div className="space-y-3"><Title>{t("Data exports")}</Title>
    <div className="card space-y-2"><p className="text-xs text-slate-500">{t("Exports are generated in the background, voter IDs are masked, files expire after 24 hours, and every export/download is audited.")}</p>
      <p className="text-xs text-slate-500">{t("Verification export groups are based on passed steps: zero, one to five, or all six.")}</p>
      <select className="input" value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t("Export type")}>{Object.entries(EXPORT_LABELS).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select>
      <select className="input" value={boothId} onChange={(e) => setBooth(e.target.value)} aria-label={t("Booth scope")}><option value="">{t("Whole organisation")}</option>{booths.data?.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select>
      {create.error && <ErrorBox error={create.error}/>}<button className="btn w-full" disabled={create.isPending} onClick={() => confirm("Create this export? It will be recorded in the audit log.") && create.mutate(undefined)}>{t("Request export")}</button></div>
    {dlErr ? <ErrorBox error={dlErr}/> : null}
    <Async q={jobs}>{(d) => d.length ? <>{d.map((j) => <div key={j.id} className="card mb-2 flex items-center justify-between text-sm"><div><p className="font-medium">{t(EXPORT_LABELS[j.kind] ?? j.kind)}</p><p className="text-xs text-slate-500">{fmt(j.createdAt)} · {j.rowCount} rows{j.lastError ? ` · ${j.lastError}` : ""}</p></div>
      <div className="flex items-center gap-2"><Badge s={j.status}/>{j.status === "READY" && <button className="btn" disabled={downloadingId !== null} aria-busy={downloadingId === j.id} onClick={() => startDownload(j)}>{t(downloadingId === j.id ? "Downloading…" : "Download")}</button>}</div></div>)}</> : <Empty text="No exports yet."/>}</Async></div>;
}
