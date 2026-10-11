import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { ImagePlus, LoaderCircle, UploadCloud } from "lucide-react";
import Badge from "../../components/Badge";
import ErrorBox from "../../components/ErrorBox";
import AttachmentImage from "../../components/AttachmentImage";
import Skeleton from "../../components/Skeleton";
import { FLOW } from "../../utils/constants";
import { fmt } from "../../utils/format";
import { uploadAttachment } from "../../services/complaintService";
import { useGet } from "../../hooks/useGet";

export default function ComplaintDetail() {
    const { id } = useParams();
    const qc = useQueryClient();
    const [fileError, setFileError] = useState("");
    const c = useGet(["complaints", id], `/complaints/${id}`);
    const t = useGet(["complaints", id, "timeline"], `/complaints/${id}/timeline`);
    const att = useGet(["complaints", id, "att"], `/complaints/${id}/attachments`);
    const up = useMutation({
        mutationFn: (file) => uploadAttachment(id, file),
        onSuccess: () => {
            setFileError("");
            qc.invalidateQueries({ queryKey: ["complaints", id, "att"] });
        },
    });
    const addPhoto = (file) => {
        if (!file)
            return;
        if (!["image/jpeg", "image/png"].includes(file.type)) {
            setFileError("Choose a JPEG or PNG image.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setFileError("Choose an image smaller than 5 MB.");
            return;
        }
        if (att.data?.length + (up.isPending ? 1 : 0) >= 3) {
            setFileError("You can add up to 3 photos to this complaint.");
            return;
        }
        setFileError("");
        up.reset();
        up.mutate(file);
    };
    const handleFileChange = (event) => {
        addPhoto(event.target.files?.[0]);
        event.target.value = "";
    };
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
    <section className="card space-y-3" aria-labelledby="complaint-photos-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="complaint-photos-heading" className="text-sm font-semibold">Photos</h2>
        <span className="text-xs text-slate-500">{att.data?.length ?? 0} of 3 added</span>
      </div>
      {att.data?.length > 0
        ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {att.data.map((a, index) => <AttachmentImage key={a.id} attachment={a} index={index} refresh={att.refetch}/>)}
          </div>
        : <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-slate-500">No photos added yet.</p>}
      {att.error && <ErrorBox error={att.error}/>}
      {(att.data?.length ?? 0) < 3 && <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-4 py-5 text-center transition hover:border-amber-500 hover:bg-amber-50 focus-within:ring-2 focus-within:ring-brand-600 ${up.isPending || att.isLoading ? "pointer-events-none opacity-60" : ""}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); addPhoto(event.dataTransfer.files?.[0]); }}
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-amber-700 shadow-sm">
          {up.isPending ? <LoaderCircle size={20} className="animate-spin" aria-hidden="true"/> : <ImagePlus size={20} aria-hidden="true"/>}
        </span>
        <span className="text-sm font-semibold text-slate-800">{up.isPending ? "Uploading photo…" : "Add a photo"}</span>
        <span className="text-xs text-slate-500">Browse or drag an image here · JPEG or PNG · up to 5 MB</span>
        <input type="file" accept="image/jpeg,image/png" aria-label="Add a complaint photo" className="sr-only" disabled={up.isPending || att.isLoading} onChange={handleFileChange}/>
      </label>}
      {fileError && <p role="alert" className="text-sm text-red-700">{fileError}</p>}
      {up.error && <ErrorBox error={up.error}/>}
      {att.data?.length >= 3 && <p className="text-xs text-slate-500">You’ve reached the 3-photo limit.</p>}
    </section>
    <div className="card text-xs text-slate-500"><h2 className="mb-1 text-sm font-semibold text-slate-700">Timeline</h2>{t.data?.map((e, i) => <p key={i}>{fmt(e.createdAt)} — {e.toStatus.replace(/_/g, " ")}{e.note ? `: ${e.note}` : ""}</p>)}</div>
  </div>;
}
