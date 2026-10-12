import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import ErrorBox from "../components/ErrorBox";
import { updateProfile } from "../services/profileService";
import { t } from "../i18n";

export default function ProfileForm({ profile }) {
  const qc = useQueryClient();
  const f = useForm({ values: { fullName: profile.fullName, phone: profile.phone ?? "" } });
  const m = useMutation({ mutationFn: updateProfile, onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile"] }); qc.invalidateQueries({ queryKey: ["me"] }); } });
  return (
    <form onSubmit={f.handleSubmit((v) => m.mutate(v))} className="card space-y-3">
      <p className="text-sm text-slate-600">{profile.email} · {String(profile.role).replace("_", " ")}</p>
      <div><label className="label" htmlFor="fn">{t("Full name")}</label><input id="fn" className="input" {...f.register("fullName", { required: true, minLength: 2 })} /></div>
      <div><label className="label" htmlFor="ph">{t("Phone")}</label><input id="ph" className="input" {...f.register("phone")} /></div>
      {m.error && <ErrorBox error={m.error} />}{m.isSuccess && <p className="text-sm text-green-700">{t("Saved.")}</p>}
      <button className="btn w-full" disabled={m.isPending}>{t("Save")}</button>
    </form>
  );
}
