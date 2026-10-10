import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Async from "../../components/Async";
import ErrorBox from "../../components/ErrorBox";
import Title from "../../components/Title";
import { patch, post } from "../../api/client";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";

export default function AdminSettings() {
    const q = useGet(["admin", "settings"], "/admin/settings");
    const [videoUrl, setVideoUrl] = useState("");
    useEffect(() => { if (q.data) setVideoUrl(q.data.loginVideoUrl ?? ""); }, [q.data]);
    const saveVideo = useAct((url) => patch("/admin/settings/login-media", { loginVideoUrl: url || null }));
    const passwordForm = useForm({
        resolver: zodResolver(z.object({
            currentPassword: z.string().min(1, "Enter your current password"),
            newPassword: z.string().min(12, "Use at least 12 characters").max(128),
            confirmPassword: z.string().min(1, "Re-enter your new password"),
        }).refine((value) => value.newPassword === value.confirmPassword, {
            path: ["confirmPassword"],
            message: "The new passwords do not match",
        })),
    });
    const changePassword = useAct((values) => post("/admin/settings/password/change", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
    }).then(() => passwordForm.reset()));
    const Row = ({ k, v }) => <div className="flex justify-between border-b border-slate-100 py-1 text-sm last:border-0"><span className="text-slate-500">{k}</span><span className="font-medium">{String(v)}</span></div>;
    return <div><Title>Settings</Title><Async q={q}>{(s) => <div className="space-y-3">
    <div className="card"><h2 className="mb-1 font-semibold">Organisation</h2><Row k="Name" v={s.organization.name}/><Row k="Slug" v={s.organization.slug}/></div>
    <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); saveVideo.mutate(videoUrl.trim()); }}>
      <div><h2 className="font-semibold">Login welcome video</h2><p className="mt-1 text-sm text-slate-600">Paste a secure Cloudinary video delivery URL. It will appear muted and loop on all sign-in pages.</p></div>
      <label className="label" htmlFor="login-video-url">Cloudinary video URL</label>
      <input id="login-video-url" className="input" type="url" maxLength={1000} placeholder="https://res.cloudinary.com/your-cloud/video/upload/welcome.mp4" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
      <p className="text-xs text-slate-500">Upload the video to Cloudinary first, then paste its HTTPS delivery URL. Only res.cloudinary.com video URLs are accepted.</p>
      {s.loginVideoUrl && <video className="max-h-56 w-full rounded-xl bg-stone-950 object-cover" src={s.loginVideoUrl} controls muted playsInline />}
      {saveVideo.error && <ErrorBox error={saveVideo.error}/>}
      {saveVideo.isSuccess && <p role="status" className="text-sm font-medium text-emerald-700">Login video saved.</p>}
      <div className="flex gap-2"><button className="btn flex-1" disabled={saveVideo.isPending}>{saveVideo.isPending ? "Saving…" : "Save video"}</button><button type="button" className="btn-ghost" disabled={!s.loginVideoUrl || saveVideo.isPending} onClick={() => { setVideoUrl(""); saveVideo.mutate(""); }}>Remove</button></div>
    </form>
    <form className="card space-y-3" onSubmit={passwordForm.handleSubmit((values) => changePassword.mutate(values))}>
      <div><h2 className="font-semibold">Change admin password</h2><p className="mt-1 text-sm text-slate-600">Confirm your current password, then enter and re-enter a new password. Other signed-in sessions will be logged out.</p></div>
      <div><label className="label" htmlFor="admin-current-password">Current password</label><input id="admin-current-password" className="input" type="password" autoComplete="current-password" {...passwordForm.register("currentPassword")} />{passwordForm.formState.errors.currentPassword && <p className="mt-1 text-xs text-red-600">{passwordForm.formState.errors.currentPassword.message}</p>}</div>
      <div><label className="label" htmlFor="admin-new-password">New password</label><input id="admin-new-password" className="input" type="password" autoComplete="new-password" {...passwordForm.register("newPassword")} />{passwordForm.formState.errors.newPassword && <p className="mt-1 text-xs text-red-600">{passwordForm.formState.errors.newPassword.message}</p>}<p className="mt-1 text-xs text-slate-500">At least 12 characters.</p></div>
      <div><label className="label" htmlFor="admin-confirm-password">Re-enter new password</label><input id="admin-confirm-password" className="input" type="password" autoComplete="new-password" {...passwordForm.register("confirmPassword")} />{passwordForm.formState.errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{passwordForm.formState.errors.confirmPassword.message}</p>}</div>
      {changePassword.error && <ErrorBox error={changePassword.error}/>}
      {changePassword.isSuccess && <p role="status" className="text-sm font-medium text-emerald-700">Password updated. Other sessions have been signed out.</p>}
      <button className="btn w-full" disabled={passwordForm.formState.isSubmitting || changePassword.isPending}>{changePassword.isPending ? "Updating password…" : "Update admin password"}</button>
    </form>
    <div className="card"><h2 className="mb-1 font-semibold">Security (read-only)</h2>{Object.entries(s.security).map(([k, v]) => <Row key={k} k={k} v={v}/>)}</div>
    <div className="card"><h2 className="mb-1 font-semibold">Limits</h2>{Object.entries(s.limits).map(([k, v]) => <Row key={k} k={k} v={v}/>)}</div>
    <p className="text-xs text-slate-400">Security settings are controlled by server configuration, not from the browser.</p></div>}</Async></div>;
}
