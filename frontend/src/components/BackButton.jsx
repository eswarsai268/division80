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
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/50 bg-white/95 text-brand-900 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      aria-label={t("Go back")}
      title={t("Go back")}
    >
      <ArrowLeft size={19} aria-hidden="true" />
    </button>
  );
}
