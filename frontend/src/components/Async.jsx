import ErrorBox from "./ErrorBox";
import Skeleton from "./Skeleton";
import { t } from "../i18n";

function Async({ q, children }) {
    if (q.isLoading)
        return <Skeleton />;
    if (q.error && q.data === undefined)
        return <div className="space-y-2"><ErrorBox error={q.error}/><button className="btn-ghost w-full" onClick={() => q.refetch()} disabled={q.isFetching}>{q.isFetching ? t("Refreshing…") : t("Retry request")}</button></div>;
    return <>{q.error && <div className="mb-2 space-y-2"><ErrorBox error={q.error}/><button className="btn-ghost w-full" onClick={() => q.refetch()} disabled={q.isFetching}>{q.isFetching ? t("Refreshing…") : t("Retry request")}</button></div>}{children(q.data)}</>;
}

export default Async;
