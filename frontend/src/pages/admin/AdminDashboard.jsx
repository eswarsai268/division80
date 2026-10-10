import Async from "../../components/Async";
import StatCard from "../../components/StatCard";
import Title from "../../components/Title";
import { useGet } from "../../hooks/useGet";

const LABELS = { booths: "Total booths", boothMembers: "Active booth members", households: "Households", pendingComplaints: "Pending complaints", inVerification: "In verification", resolved: "Resolved", upcomingEvents: "Upcoming events" };

export default function AdminDashboard() {
  const q = useGet(["admin", "dash"], "/admin/dashboard");
  return (
    <div><Title>Admin dashboard</Title>
      <Async q={q}>{(d) => <div className="grid grid-cols-2 gap-3">{Object.entries(d).map(([k, v]) => <StatCard key={k} value={v} label={LABELS[k] ?? k} />)}</div>}</Async>
    </div>
  );
}
