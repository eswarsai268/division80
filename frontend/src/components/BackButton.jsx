import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { t } from "../i18n";

export default function BackButton({ fallback = "/" }) {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = () => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }
    navigate(fallback, { replace: true, state: { from: location.pathname } });
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-amber-700/25 bg-amber-50 text-stone-900 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
      aria-label={t("Go back")}
      title={t("Go back")}
    >
      <ArrowLeft size={19} aria-hidden="true" />
    </button>
  );
}
