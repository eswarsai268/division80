import { t } from "../i18n";

const ErrorBox = ({ error }) => {
    const e = error;
    const msg = e?.code === "NETWORK_ERROR" ? t(e.message)
        : e?.status === 401 ? "Your session expired. Sign in again to continue."
        : e?.status === 403 ? "Access denied. This account does not have permission for this action."
        : e?.status === 404 ? (e.message || "The requested page or record was not found.")
        : e?.status === 409 ? (e.message || "Conflict — refresh and try again.")
        : e?.status === 422 ? (e.message || "Some submitted details are invalid. Check the form and try again.")
        : e?.status === 429 ? "Too many requests — wait a moment and try again."
        : e?.status >= 500 ? `The server could not complete this request${e.requestId ? ` (request ID: ${e.requestId})` : ""}. Please try again.`
        : e?.message ?? "Something went wrong.";
    return <div role="alert" className="card border-red-200 bg-red-50 text-sm text-red-800">
      <p>{t(msg)}</p>
      {e?.status && e.status < 500 && e.status !== 401 && <p className="mt-1 text-xs text-red-700">{t("HTTP")} {e.status}{e.code && e.code !== "INVALID_RESPONSE" ? ` · ${e.code}` : ""}</p>}
      {e?.requestId && e.status < 500 && <p className="mt-1 text-xs text-red-700">Request ID: {e.requestId}</p>}
    </div>;
};

export default ErrorBox;
