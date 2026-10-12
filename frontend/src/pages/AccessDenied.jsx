import { Link } from "react-router-dom";
import { homeFor } from "../auth/paths";
import { PORTALS } from "../utils/constants";
import { t } from "../i18n";

export default function AccessDenied({ role }) {
  const accountType = PORTALS[role] ?? "another account type";
  return (
    <div className="p-8 text-center">
      <h1 className="text-lg font-semibold">{t("Access denied")}</h1>
      <p className="mt-1 text-slate-600">{t("This page is only available to booth members. You are signed in as")} {accountType}.</p>
      <Link to={homeFor(role)} className="btn mt-4 inline-flex">{t("Go to your dashboard")}</Link>
    </div>
  );
}
