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
import { t } from "../../i18n";

export default function AdminSettings() {
    const q = useGet(["admin", "settings"], "/admin/settings");
    const [videoUrl, setVideoUrl] = useState("");
const [slipTitle, setSlipTitle] = useState("");
const [wardNumber, setWardNumber] = useState("");
const [pollingDateText, setPollingDateText] = useState("");
const [ageReferenceDate, setAgeReferenceDate] = useState("");
const [publicationDate, setPublicationDate] = useState("");
const [bannerPath, setBannerPath] = useState("");
const [headerBannerPath, setHeaderBannerPath] = useState("");
const [templateUrl, setTemplateUrl] = useState("");
const [accentColor, setAccentColor] = useState("");
    useEffect(() => { if (q.data) { setVideoUrl(q.data.loginVideoUrl ?? ""); const s = q.data.slip || {}; setSlipTitle(s.slipTitle ?? ""); setWardNumber(s.wardNumber ?? ""); setPollingDateText(s.pollingDateText ?? ""); setAgeReferenceDate(s.ageReferenceDate ?? ""); setPublicationDate(s.publicationDate ?? ""); setBannerPath(s.bannerPath ?? ""); setHeaderBannerPath(s.headerBannerPath ?? ""); setAccentColor(s.accentColor ?? ""); setTemplateUrl(s.templateUrl ?? ""); } }, [q.data]);
    const saveVideo = useAct((url) => patch("/admin/settings/login-media", { loginVideoUrl: url || null }));
const saveSlip = useAct((payload) => patch("/admin/settings/slip", payload));
    const passwordForm = useForm({
        resolver: zodResolver(z.object({
            currentPassword: z.string().min(1, "Enter your current password"),
            newPassword: z.string().min(4, "Use at least 4 characters").max(128),
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
    return <div><Title>{t("Settings")}</Title><Async q={q}>{(s) => <div className="space-y-3">
    <div className="card"><h2 className="mb-1 font-semibold">{t("Organisation")}</h2><Row k={t("Name")} v={s.organization.name}/><Row k="Slug" v={s.organization.slug}/></div>
    <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); saveVideo.mutate(videoUrl.trim()); }}>
      <div><h2 className="font-semibold">{t("Login welcome video")}</h2><p className="mt-1 text-sm text-slate-600">{t("Paste a secure Cloudinary video delivery URL. It will appear muted and loop on all sign-in pages.")}</p></div>
      <label className="label" htmlFor="login-video-url">{t("Cloudinary video URL")}</label>
      <input id="login-video-url" className="input" type="url" maxLength={1000} placeholder="https://res.cloudinary.com/your-cloud/video/upload/welcome.mp4" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
      <p className="text-xs text-slate-500">{t("Upload the video to Cloudinary first, then paste its HTTPS delivery URL. Only res.cloudinary.com video URLs are accepted.")}</p>
      {s.loginVideoUrl && <video className="max-h-56 w-full rounded-xl bg-stone-950 object-cover" src={s.loginVideoUrl} controls muted playsInline />}
      {saveVideo.error && <ErrorBox error={saveVideo.error}/>}
      {saveVideo.isSuccess && <p role="status" className="text-sm font-medium text-emerald-700">{t("Login video saved.")}</p>}
      <div className="flex gap-2"><button className="btn flex-1" disabled={saveVideo.isPending}>{saveVideo.isPending ? "Saving…" : "Save video"}</button><button type="button" className="btn-ghost" disabled={!s.loginVideoUrl || saveVideo.isPending} onClick={() => { setVideoUrl(""); saveVideo.mutate(""); }}>{t("Remove")}</button></div>
    </form>
    <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); saveSlip.mutate({ slipTitle: slipTitle.trim() || undefined, wardNumber: wardNumber.trim() || undefined, pollingDateText: pollingDateText.trim() || undefined, ageReferenceDate: ageReferenceDate.trim() || undefined, publicationDate: publicationDate.trim() || undefined, bannerPath: bannerPath.trim() || null, headerBannerPath: headerBannerPath.trim() || null, accentColor: accentColor.trim() || undefined, templateUrl: templateUrl.trim() || null }); }}>
      <div><h2 className="font-semibold">{t("Voter slip design")}</h2><p className="mt-1 text-sm text-slate-600">{t("Configure the title, ward, polling date and images used on the printed voter slip. Paste Cloudinary image URLs for the header and footer banners.")}</p></div>
      <div><label className="label">{t("Slip title")}</label><input className="input" value={slipTitle} onChange={(e) => setSlipTitle(e.target.value)} maxLength={200} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">{t("Ward number")}</label><input className="input" value={wardNumber} onChange={(e) => setWardNumber(e.target.value)} maxLength={16} /></div>
        <div><label className="label">{t("Polling date text")}</label><input className="input" value={pollingDateText} onChange={(e) => setPollingDateText(e.target.value)} maxLength={100} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">{t("Age reference date")}</label><input className="input" type="date" value={ageReferenceDate} onChange={(e) => setAgeReferenceDate(e.target.value)} /></div>
        <div><label className="label">{t("Publication date")}</label><input className="input" type="date" value={publicationDate} onChange={(e) => setPublicationDate(e.target.value)} /></div>
      </div>
      <div><label className="label">{t("Accent color")}</label><input className="input" type="color" value={accentColor || "#1e3a8a"} onChange={(e) => setAccentColor(e.target.value)} /></div>
      <div><label className="label">{t("Header banner URL (Cloudinary)")}</label><input className="input" type="url" maxLength={255} placeholder="https://res.cloudinary.com/your-cloud/image/upload/header.png" value={headerBannerPath} onChange={(e) => setHeaderBannerPath(e.target.value)} /></div>
      <div><label className="label">{t("Footer banner URL (Cloudinary)")}</label><input className="input" type="url" maxLength={255} placeholder="https://res.cloudinary.com/your-cloud/image/upload/footer.png" value={bannerPath} onChange={(e) => setBannerPath(e.target.value)} /></div>
      <div><label className="label">{t("Full slip template URL (Cloudinary)")}</label><input className="input" type="url" maxLength={500} placeholder="https://res.cloudinary.com/your-cloud/image/upload/slip-template.png" value={templateUrl} onChange={(e) => setTemplateUrl(e.target.value)} /></div>
      {saveSlip.error && <ErrorBox error={saveSlip.error}/>}
      {saveSlip.isSuccess && <p role="status" className="text-sm font-medium text-emerald-700">{t("Slip design saved.")}</p>}
      <div className="flex gap-2"><button className="btn flex-1" disabled={saveSlip.isPending}>{saveSlip.isPending ? "Saving…" : "Save slip design"}</button></div>
    </form>
    <form className="card space-y-3" onSubmit={passwordForm.handleSubmit((values) => changePassword.mutate(values))}>
      <div><h2 className="font-semibold">{t("Change admin password")}</h2><p className="mt-1 text-sm text-slate-600">{t("Confirm your current password, then enter and re-enter a new password. Other signed-in sessions will be logged out.")}</p></div>
      <div><label className="label" htmlFor="admin-current-password">{t("Current password")}</label><input id="admin-current-password" className="input" type="password" autoComplete="current-password" {...passwordForm.register("currentPassword")} />{passwordForm.formState.errors.currentPassword && <p className="mt-1 text-xs text-red-600">{passwordForm.formState.errors.currentPassword.message}</p>}</div>
      <div><label className="label" htmlFor="admin-new-password">{t("New password")}</label><input id="admin-new-password" className="input" type="password" autoComplete="new-password" {...passwordForm.register("newPassword")} />{passwordForm.formState.errors.newPassword && <p className="mt-1 text-xs text-red-600">{passwordForm.formState.errors.newPassword.message}</p>}<p className="mt-1 text-xs text-slate-500">{t("At least 4 characters.")}</p></div>
      <div><label className="label" htmlFor="admin-confirm-password">{t("Re-enter new password")}</label><input id="admin-confirm-password" className="input" type="password" autoComplete="new-password" {...passwordForm.register("confirmPassword")} />{passwordForm.formState.errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{passwordForm.formState.errors.confirmPassword.message}</p>}</div>
      {changePassword.error && <ErrorBox error={changePassword.error}/>}
      {changePassword.isSuccess && <p role="status" className="text-sm font-medium text-emerald-700">{t("Password updated. Other sessions have been signed out.")}</p>}
      <button className="btn w-full" disabled={passwordForm.formState.isSubmitting || changePassword.isPending}>{changePassword.isPending ? "Updating password…" : "Update admin password"}</button>
    </form>
    <div className="card"><h2 className="mb-1 font-semibold">{t("Security (read-only)")}</h2>{Object.entries(s.security).map(([k, v]) => <Row key={k} k={k} v={v}/>)}</div>
    <div className="card"><h2 className="mb-1 font-semibold">{t("Limits")}</h2>{Object.entries(s.limits).map(([k, v]) => <Row key={k} k={k} v={v}/>)}</div>
    <p className="text-xs text-slate-400">{t("Security settings are controlled by server configuration, not from the browser.")}</p></div>}</Async></div>;
}
