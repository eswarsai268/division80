import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import {
  ArrowRight, CalendarDays, CheckCircle2, CircleAlert, Clock3, LockKeyhole, Mail,
  Phone, Save, ShieldCheck, UserRound, XCircle,
} from "lucide-react";
import Async from "../../components/Async";
import ErrorBox from "../../components/ErrorBox";
import { useGet } from "../../hooks/useGet";
import { api } from "../../api/client";
import { updateProfile } from "../../services/profileService";

const roleLabel = (role) => role === "USER" ? "Citizen" : String(role ?? "").replaceAll("_", " ").toLowerCase();
const namePattern = /^[\p{L}\p{M}]+(?:[ .'-’][\p{L}\p{M}]+)*$/u;

function phoneDigits(value) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  return digits;
}

const formatPhone = (digits) => digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;

function memberSince(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function ProfileContent({ profile }) {
  const qc = useQueryClient();
  const form = useForm({ values: { fullName: profile.fullName ?? "", phone: phoneDigits(profile.phone) } });
  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
  const isAdmin = profile.role === "ADMIN";
  // Fetch every page so the activity totals stay accurate for large accounts/organizations.
  const complaints = useGet(["profile", "complaints", profile.role], isAdmin ? "/admin/complaints?limit=100" : "/complaints/mine?limit=100", {
    queryFn: async ({ signal }) => {
      const items = [];
      let cursor;
      do {
        const query = new URLSearchParams({ limit: "100" });
        if (cursor) query.set("cursor", cursor);
        const page = await api(`${isAdmin ? "/admin/complaints" : "/complaints/mine"}?${query}`, { signal });
        items.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      return items;
    },
  });
  const events = useGet(["profile", "upcoming-events"], "/public/events");
  const initials = (profile.fullName || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const complaintRows = complaints.data ?? [];
  const resolvedCount = complaintRows.filter((item) => item.status === "RESOLVED").length;
  const upcomingEvents = (events.data ?? []).filter((event) => event.startsAt && new Date(event.startsAt).getTime() >= Date.now()).length;

  return (
    <div className="profile-page space-y-7">
      <h1 className="text-3xl font-bold tracking-tight text-slate-800">My profile</h1>

      <section className="profile-summary" aria-label="Profile summary">
        <div className="profile-avatar" aria-hidden="true">{initials}</div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-bold text-slate-800">{profile.fullName || "Name not set"}</h2>
            <span className="profile-role-badge">{roleLabel(profile.role)}</span>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">{roleLabel(profile.role)} account</p>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm font-semibold text-amber-700"><Mail size={14} /><span className="truncate">{profile.email}</span></p>
        </div>
      </section>

      <section>
        <h2 className="profile-section-title">Account details</h2>
        <form className="profile-form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <div>
            <label className="profile-label" htmlFor="profile-full-name">Full name</label>
            <div className="profile-input-wrap"><UserRound size={18} aria-hidden="true" /><input id="profile-full-name" autoComplete="name" maxLength={200} className="profile-input" {...form.register("fullName", {
              required: "Enter your full name",
              validate: (value) => {
                const name = value.trim();
                if (name.length < 2) return "Name must be at least 2 characters";
                if (name.length > 200) return "Name must be 200 characters or fewer";
                return namePattern.test(name) || "Use letters, spaces, apostrophes, periods, or hyphens in your name";
              },
            })} /></div>
            {form.formState.errors.fullName && <p className="profile-field-error" role="alert">{form.formState.errors.fullName.message}</p>}
          </div>

          <div>
            <label className="profile-label" htmlFor="profile-phone">Phone number</label>
            <div className="profile-input-wrap"><Phone size={18} aria-hidden="true" /><span className="profile-phone-prefix" aria-hidden="true">+91</span><Controller control={form.control} name="phone" rules={{ validate: (value) => !value || value.length === 10 || "Enter exactly 10 digits" }} render={({ field }) => <input id="profile-phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={24} aria-describedby="profile-phone-hint" placeholder="98765 43210" className="profile-input" value={formatPhone(field.value ?? "")} onBlur={field.onBlur} onChange={(event) => field.onChange(phoneDigits(event.target.value))} />} /></div>
            <p id="profile-phone-hint" className="profile-privacy-note">Enter a 10-digit mobile number. +91 is added automatically.</p>
            {form.formState.errors.phone && <p className="profile-field-error" role="alert">{form.formState.errors.phone.message}</p>}
          </div>

          <div>
            <label className="profile-label profile-label-muted" htmlFor="profile-email">Email address</label>
            <div className="profile-email-wrap"><input id="profile-email" className="profile-input" value={profile.email ?? ""} readOnly aria-describedby="profile-email-note" /><LockKeyhole size={18} className="text-slate-500" aria-hidden="true" /></div>
            <p id="profile-email-note" className="profile-privacy-note">Email is used to sign in and can’t be changed here. Account details are used to manage your citizen profile.</p>
          </div>

          {mutation.error && <ErrorBox error={mutation.error} />}
          {mutation.isSuccess && <p className="text-sm font-medium text-emerald-700" role="status">Profile changes saved.</p>}
          <button className="profile-save" type="submit" disabled={mutation.isPending || !form.formState.isDirty}>
            {mutation.isPending ? "Saving…" : "Save changes"}<Save size={17} aria-hidden="true" />
          </button>
          <button className="profile-cancel" type="button" disabled={!form.formState.isDirty || mutation.isPending} onClick={() => { form.reset({ fullName: profile.fullName ?? "", phone: phoneDigits(profile.phone) }); mutation.reset(); }}>
            <XCircle size={16} aria-hidden="true" /> Cancel changes
          </button>
        </form>
      </section>

      <div className="profile-member-since"><CalendarDays size={16} aria-hidden="true" /><span>Member since: {memberSince(profile.createdAt)}</span></div>

      <section>
        <h2 className="profile-section-title">Recent activity</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link to={isAdmin ? "/admin/complaints" : "/complaints"} className="profile-stat-card" aria-label="View complaints">
            <span className="profile-stat-icon text-amber-700"><CircleAlert size={19} /></span>
            <Async q={complaints}>{(rows) => <strong>{rows.length}</strong>}</Async>
            <span className="profile-stat-label">Complaints</span>
          </Link>
          <Link to={isAdmin ? "/admin/complaints?status=RESOLVED" : "/complaints"} className="profile-stat-card" aria-label="View resolved complaints">
            <span className="profile-stat-icon bg-emerald-50 text-emerald-800"><CheckCircle2 size={19} /></span>
            <Async q={complaints}>{() => <strong>{resolvedCount}</strong>}</Async>
            <span className="profile-stat-label">Resolved</span>
          </Link>
          <Link to="/events" className="profile-stat-card" aria-label="View upcoming events">
            <span className="profile-stat-icon bg-slate-200 text-slate-700"><Clock3 size={19} /></span>
            <Async q={events}>{() => <strong>{upcomingEvents}</strong>}</Async>
            <span className="profile-stat-label">Upcoming events</span>
          </Link>
          <div className="profile-stat-card" aria-label="Engagement score unavailable">
            <span className="profile-stat-icon bg-amber-100 text-amber-700"><ShieldCheck size={19} /></span>
            <strong>—</strong>
            <span className="profile-stat-label">Engagement unavailable</span>
          </div>
        </div>

        <Link to={isAdmin ? "/admin/complaints" : "/complaints"} className="profile-activity-link">
          <span className="profile-activity-icon"><CircleAlert size={19} /></span>
          <span className="min-w-0 flex-1"><strong>View complaints</strong><small>Track your submitted complaints and updates</small></span>
          <ArrowRight size={18} className="text-slate-400" aria-hidden="true" />
        </Link>
      </section>

      <footer className="profile-footer"><p>{profile.fullName || "Citizen"} · {roleLabel(profile.role)} portal</p><p>Local community impact</p></footer>
    </div>
  );
}

export default function Profile() {
  const profile = useGet(["profile"], "/profile");
  return <Async q={profile}>{(data) => <ProfileContent profile={data} />}</Async>;
}
