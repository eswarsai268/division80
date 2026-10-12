import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import ErrorBox from "../components/ErrorBox";
import { createComplaint } from "../services/complaintService";
import { complaintSchema } from "./schemas";
import { t } from "../i18n";

const CATEGORIES = ["ROADS", "WATER", "LIGHTING", "SANITATION", "OTHER"];

export default function ComplaintForm() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const f = useForm({ resolver: zodResolver(complaintSchema), defaultValues: { category: "ROADS" } });
  const m = useMutation({ mutationFn: createComplaint, onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["complaints"] }); nav(`/complaints/${r.id}`); } });
  const err = f.formState.errors;
  return (
    <form onSubmit={f.handleSubmit((v) => m.mutate(v))} className="card space-y-3">
      <div><label className="label" htmlFor="t">{t("Title")}</label><input id="t" className="input" {...f.register("title")} />{err.title && <p className="text-xs text-red-600">{err.title.message}</p>}</div>
      <div><label className="label" htmlFor="c">{t("Category")}</label><select id="c" className="input" {...f.register("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div><label className="label" htmlFor="d">{t("Description")}</label><textarea id="d" rows={4} className="input" {...f.register("description")} />{err.description && <p className="text-xs text-red-600">{err.description.message}</p>}</div>
      <div><label className="label" htmlFor="l">{t("Location")}</label><input id="l" className="input" {...f.register("location")} /></div>
      <p className="text-xs text-slate-500">{t("You can add photos on the next screen after submitting.")}</p>
      {m.error && <ErrorBox error={m.error} />}
      <button className="btn w-full" disabled={m.isPending}>{t("Submit")}</button>
    </form>
  );
}
