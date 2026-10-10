export default function StatCard({ value, label }) {
  return (
    <div className="card">
      <p className="text-2xl font-semibold text-brand-700">{value}</p>
      <p className="text-xs text-slate-600">{label}</p>
    </div>
  );
}
