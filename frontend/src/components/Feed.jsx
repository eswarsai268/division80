import Empty from "./Empty";
import { fmt } from "../utils/format";

const Feed = ({ items, empty }) => items?.length ? <>{items.map((a) => <div key={a.id} className="card mb-2"><p className="font-medium">{a.title}</p><p className="text-sm text-slate-600">{a.body}</p><p className="mt-1 text-xs text-slate-400">{fmt(a.startsAt ?? a.publishedAt)}</p></div>)}</> : <Empty text={empty}/>;
export default Feed;
