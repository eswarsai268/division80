import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import Badge from "../../components/Badge";
import ErrorBox from "../../components/ErrorBox";
import Skeleton from "../../components/Skeleton";
import { FLOW } from "../../utils/constants";
import { fmt } from "../../utils/format";
import { uploadAttachment } from "../../services/complaintService";
import { useGet } from "../../hooks/useGet";

export default function ComplaintDetail() {
    const { id } = useParams();
    const qc = useQueryClient();
    const c = useGet(["complaints", id], `/complaints/${id}`);
    const t = useGet(["complaints", id, "timeline"], `/complaints/${id}/timeline`);
    const att = useGet(["complaints", id, "att"], `/complaints/${id}/attachments`);
    const up = useMutation({
        mutationFn: (file) => uploadAttachment(id, file),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["complaints", id, "att"] }),
    });
    if (c.isLoading)
        return <Skeleton />;
    if (c.error)
        return <ErrorBox error={c.error}/>;
    const idx = FLOW.indexOf(c.data.status);
    return <div className="space-y-3">
    <div className="card"><div className="flex justify-between"><h1 className="font-semibold">{c.data.title}</h1><Badge s={c.data.status}/></div><p className="mt-2 text-sm text-slate-600">{c.data.description}</p></div>
    <div className="card complaint-progress-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Progress</h2>
        {idx >= 0 && <span className="text-xs font-medium text-brand-700">Step {idx + 1} of {FLOW.length}</span>}
      </div>
      <ol className="complaint-progress" aria-label="Complaint progress">
        {FLOW.map((s, i) => {
          const state = i < idx ? "complete" : i === idx ? "current" : "upcoming";
          return <li key={s} className={`complaint-progress-step is-${state}`}>
            <span className="complaint-progress-track" aria-hidden="true">
              <span className="complaint-progress-track-fill" />
            </span>
            <span className="complaint-progress-node" aria-hidden="true">{state === "complete" ? "✓" : i + 1}</span>
            <span className="complaint-progress-label">{s.replace(/_/g, " ")}</span>
            {state === "current" && <span className="sr-only">Current status</span>}
          </li>;
        })}
      </ol>
    </div>
    <div className="card space-y-2"><h2 className="text-sm font-semibold">Photos</h2>
      <div className="flex flex-wrap gap-2">{att.data?.map((a) => <img key={a.id} src={a.url} alt="Complaint attachment" className="h-24 w-24 rounded-lg object-cover"/>)}{att.data?.length === 0 && <p className="text-xs text-slate-500">No photos yet.</p>}</div>
      <input type="file" accept="image/jpeg,image/png" aria-label="Add photo" className="text-sm" onChange={(e) => { const f = e.target.files?.[0]; if (f)
        up.mutate(f); e.target.value = ""; }}/>
      {up.error && <ErrorBox error={up.error}/>}<p className="text-xs text-slate-400">JPEG or PNG, up to 5 MB, max 3 photos.</p></div>
    <div className="card text-xs text-slate-500"><h2 className="mb-1 text-sm font-semibold text-slate-700">Timeline</h2>{t.data?.map((e, i) => <p key={i}>{fmt(e.createdAt)} — {e.toStatus.replace(/_/g, " ")}{e.note ? `: ${e.note}` : ""}</p>)}</div>
  </div>;
}
