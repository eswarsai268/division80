import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import Title from "../../components/Title";
import { fmt } from "../../utils/format";
import { useGet } from "../../hooks/useGet";
import { useMe } from "../../auth/useMe";
import { api } from "../../api/client";
import { isOfflineFallbackError, readOfflineSnapshot } from "../../services/offlineRoster";
import { t } from "../../i18n";

export default function VerificationsPage() {
    const { data: me } = useMe();
    const q = useGet(["booth", "verifications"], "/booth/verifications", {
        queryFn: async ({ signal }) => {
            if (me?.isOffline || !navigator.onLine) {
                const saved = await readOfflineSnapshot("verifications");
                if (saved !== null) return saved;
                throw new Error("Verification history has not been saved on this device. Reconnect and open this page to cache it.");
            }
            try { return await api("/booth/verifications", { signal }); }
            catch (error) {
                if (!isOfflineFallbackError(error)) throw error;
                const saved = await readOfflineSnapshot("verifications");
                if (saved !== null) return saved;
                throw error;
            }
        },
    });
    return <div><Title>{t("Recent verifications")}</Title>{q.data?.length > 0 && <p className="mb-2 text-sm text-slate-600">{t("Total")}: {q.data.length} {t("verification records")}</p>}<Async q={q}>{(d) => d.length ? <>{d.map((v) => <div key={v.id} className={`card mb-2 text-sm ${v.result === "PASSED" ? "border-l-4 border-emerald-500" : ""}`}><div className="flex justify-between"><span>{t("House")} {v.houseCode} · {v.citizenName}</span><Badge s={v.result}/></div><p className="text-xs text-slate-500">{t("Step")} {v.step} · {v.verifier} · {fmt(v.createdAt)}</p></div>)}</> : <Empty text="No verifications recorded yet."/>}</Async></div>;
}
