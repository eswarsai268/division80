
import BackButton from "../components/BackButton";
import { t } from "../i18n";

export default function NotFound() {
  return <div className="p-8 text-center"><BackButton fallback="/" /><p className="mt-4">{t("Page not found")}</p></div>;
}
