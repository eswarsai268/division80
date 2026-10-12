import { t } from "../i18n";

const COLORS = { PENDING: "bg-amber-100 text-amber-800", SUBMITTED: "bg-slate-100 text-slate-700", UNDER_REVIEW: "bg-blue-100 text-blue-800", ASSIGNED: "bg-indigo-100 text-indigo-800",
    IN_VERIFICATION: "bg-blue-100 text-blue-800", RESOLVED: "bg-green-100 text-green-800", APPROVED: "bg-green-100 text-green-800", REJECTED: "bg-red-100 text-red-800", FAILED: "bg-red-100 text-red-800",
    PASSED: "bg-green-100 text-green-800", EXPIRED: "bg-slate-100 text-slate-600", ACTIVE: "bg-green-100 text-green-800", INACTIVE: "bg-slate-100 text-slate-600", SUSPENDED: "bg-red-100 text-red-800",
    PUBLISHED: "bg-green-100 text-green-800", DRAFT: "bg-slate-100 text-slate-700", ARCHIVED: "bg-slate-100 text-slate-500", READY: "bg-green-100 text-green-800", QUEUED: "bg-amber-100 text-amber-800",
    PREVIEW: "bg-blue-100 text-blue-800", COMMITTING: "bg-amber-100 text-amber-800", COMMITTED: "bg-green-100 text-green-800", PROCESSING: "bg-amber-100 text-amber-800", DENIED: "bg-red-100 text-red-800", SUCCESS: "bg-green-100 text-green-800", FAILURE: "bg-red-100 text-red-800" };
const Badge = ({ s }) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[s] ?? "bg-slate-100 text-slate-700"}`}>{t(s.replace(/_/g, " "))}</span>;

export default Badge;
