import { Link } from "react-router-dom";
import LoginForm from "../../forms/LoginForm";
import AuthLayout from "../../layouts/AuthLayout";
import { PORTALS } from "../../utils/constants";
import { t, useLanguage } from "../../i18n";

export default function LoginPage({ portal }) {
  useLanguage();
  return (
    <AuthLayout title={`Sign in as ${PORTALS[portal]}`} subtitle={t("Access your secure community workspace.")}>
      <nav className="portal-tabs" aria-label={t("Sign-in portal")}>
        {[["USER", "Citizen", "/login"], ["BOOTH_MEMBER", "Booth", "/booth/login"], ["ADMIN", "Admin", "/admin/login"]].map(([key, label, to]) => <Link key={key} to={to} aria-current={portal === key ? "page" : undefined} className={`portal-tab ${portal === key ? "is-active" : ""}`}>{t(label)}</Link>)}
      </nav>
      <LoginForm portal={portal} />
      <div className="mt-4 space-y-1 text-center text-sm">
        {portal === "USER" && <p>{t("New here?")} <Link to="/register" className="text-brand-600 underline">{t("Create account")}</Link></p>}
        {portal === "BOOTH_MEMBER" && <p className="text-xs text-slate-500">{t("Booth logins are created and assigned by an administrator. Use the email and temporary password they provided.")}</p>}
      </div>
    </AuthLayout>
  );
}
