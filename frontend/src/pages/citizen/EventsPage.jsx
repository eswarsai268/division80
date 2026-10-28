import Async from "../../components/Async";
import Feed from "../../components/Feed";
import Title from "../../components/Title";
import { useGet } from "../../hooks/useGet";
import { api } from "../../api/client";
import { useMe } from "../../auth/useMe";
import { isOfflineFallbackError, readOfflineSnapshot } from "../../services/offlineRoster";
import { t } from "../../i18n";

export default function EventsPage() {
    const { data: me } = useMe();
    const offline = me?.role === "BOOTH_MEMBER" && Boolean(me.isOffline || !navigator.onLine);
    const cachedQuery = (path, snapshot) => async ({ signal }) => {
        if (offline) {
            const saved = await readOfflineSnapshot(snapshot);
            if (saved !== null) return saved;
            throw new Error("This information has not been saved on this device. Reconnect and open this page to cache it.");
        }
        try { return await api(path, { signal }); }
        catch (error) {
            if (!isOfflineFallbackError(error) || me?.role !== "BOOTH_MEMBER") throw error;
            const saved = await readOfflineSnapshot(snapshot);
            if (saved !== null) return saved;
            throw error;
        }
    };
    const ev = useGet(["events"], "/public/events", { queryFn: cachedQuery("/public/events", "events") });
    const an = useGet(["announcements"], "/public/announcements", { queryFn: cachedQuery("/public/announcements", "announcements") });
    return <div><Title>{t("Events in our colony")}</Title><Async q={ev}>{(d) => <Feed items={d} empty="No upcoming events."/>}</Async><h2 className="mb-2 mt-5 font-semibold text-brand-900">{t("Announcements")}</h2><Async q={an}>{(d) => <Feed items={d} empty="No announcements."/>}</Async></div>;
}
