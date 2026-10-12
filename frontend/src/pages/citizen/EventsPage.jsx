import Async from "../../components/Async";
import Feed from "../../components/Feed";
import Title from "../../components/Title";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";

export default function EventsPage() {
    const ev = useGet(["events"], "/public/events");
    const an = useGet(["announcements"], "/public/announcements");
    return <div><Title>{t("Events in our colony")}</Title><Async q={ev}>{(d) => <Feed items={d} empty="No upcoming events."/>}</Async><h2 className="mb-2 mt-5 font-semibold text-brand-900">{t("Announcements")}</h2><Async q={an}>{(d) => <Feed items={d} empty="No announcements."/>}</Async></div>;
}
