import { Link } from "react-router-dom";
import Async from "../../components/Async";
import StatCard from "../../components/StatCard";
import Title from "../../components/Title";
import { useGet } from "../../hooks/useGet";

export default function BoothDashboard() {
  const q = useGet(["booth", "dashboard"], "/booth/dashboard");
  return (
    <div><Title>Booth dashboard</Title>
      <Async q={q}>{(d) => {
        const c = d.complaints ?? {};
        const pending = (c.SUBMITTED ?? 0) + (c.UNDER_REVIEW ?? 0) + (c.ASSIGNED ?? 0);
        const cards = [["Assigned booths", d.booths], ["Households", Object.values(d.households).reduce((a, b) => a + b, 0)], ["Pending verification", d.households.PENDING + d.households.IN_VERIFICATION], ["Pending complaints", pending], ["Resolved complaints", c.RESOLVED ?? 0], ["Resolved houses", d.households.RESOLVED]];
        return <div className="grid grid-cols-2 gap-3">{cards.map(([l, n]) => <StatCard key={l} value={n} label={l} />)}<Link to="/booth/households" className="btn col-span-2">Search houses (e.g. G-24)</Link></div>;
      }}</Async>
    </div>
  );
}
