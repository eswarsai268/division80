import Async from "../../components/Async";
import Feed from "../../components/Feed";
import Title from "../../components/Title";
import { useGet } from "../../hooks/useGet";

export default function EventsPage() {
    const ev = useGet(["events"], "/public/events");
    const an = useGet(["announcements"], "/public/announcements");
    return <div><Title>Events in our colony</Title><Async q={ev}>{(d) => <Feed items={d} empty="No upcoming events."/>}</Async><h2 className="mb-2 mt-5 font-semibold text-brand-900">Announcements</h2><Async q={an}>{(d) => <Feed items={d} empty="No announcements."/>}</Async></div>;
}
