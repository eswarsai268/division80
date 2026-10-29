import { useState } from "react";
import { Printer } from "lucide-react";
import Async from "../../components/Async";
import Empty from "../../components/Empty";
import VoterSlip from "../../components/VoterSlip";
import { api } from "../../api/client";
import { useGet } from "../../hooks/useGet";
import { t } from "../../i18n";

export default function PrintSlips() {
  const [boothId, setBoothId] = useState("");
  const [pollingStation, setPollingStation] = useState("");
  const [doorFrom, setDoorFrom] = useState("");
  const [doorTo, setDoorTo] = useState("");
  const [page, setPage] = useState(1);
  const [allSlips, setAllSlips] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const booths = useGet(["admin", "booths"], "/admin/booths");

  const loadPage = async (p) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "200" });
      if (boothId) params.set("booth", boothId);
      if (pollingStation) params.set("pollingStation", pollingStation);
      if (doorFrom) params.set("doorFrom", doorFrom);
      if (doorTo) params.set("doorTo", doorTo);
      const res = await api(`/slips/batch?${params}`);
      setSettings(res.settings);
      setAllSlips((prev) => (p === 1 ? res.items : [...prev, ...res.items]));
      setPage(p);
    } catch (e) { setError(e?.message || "Failed to load slips"); }
    finally { setLoading(false); }
  };

  const loadAll = async () => {
    setAllSlips([]); setPage(1); setSettings(null);
    setLoading(true); setError("");
    try {
      let p = 0;
      while (true) {
        const nextP = p + 1;
        const params = new URLSearchParams({ page: String(nextP), pageSize: "200" });
        if (boothId) params.set("booth", boothId);
        if (pollingStation) params.set("pollingStation", pollingStation);
        if (doorFrom) params.set("doorFrom", doorFrom);
        if (doorTo) params.set("doorTo", doorTo);
        const res = await api(`/slips/batch?${params}`);
        if (!res.items || res.items.length === 0) break;
        setSettings(res.settings);
        setAllSlips((prev) => [...prev, ...res.items]);
        p = nextP;
        if (res.items.length < 200) break;
      }
      setPage(p);
    } catch (e) { setError(e?.message || "Failed to load slips"); }
    finally { setLoading(false); }
  };

  const handlePrint = () => {
    const n = allSlips.length;
    if (!confirm(`Printing ${n} slips. Continue?`)) return;
    window.print();
  };

  return (
    <div className="print-slip-page space-y-4">
      <div className="no-print space-y-3">
        <h1 className="text-lg font-bold">{t("Print voter slips")}</h1>
        <div className="card space-y-2">
          <select className="input" value={boothId} onChange={(e) => setBoothId(e.target.value)} aria-label={t("Booth")}>
            <option value="">{t("All booths")}</option>
            {booths.data?.map((b) => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
          </select>
          <input className="input" placeholder={t("Polling station (e.g. 79/1)")} value={pollingStation} onChange={(e) => setPollingStation(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder={t("Door from")} value={doorFrom} onChange={(e) => setDoorFrom(e.target.value)} />
            <input className="input" placeholder={t("Door to")} value={doorTo} onChange={(e) => setDoorTo(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn flex-1" disabled={loading} onClick={() => loadPage(1)}>{loading ? t("Loading…") : t("Load slips")}</button>
            <button className="btn-ghost" disabled={loading} onClick={loadAll}>{loading ? t("Loading…") : t("Load all")}</button>
            {allSlips.length > 0 && <button className="btn-ghost" onClick={() => { setAllSlips([]); setPage(1); setSettings(null); }}>{t("Clear")}</button>}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        {allSlips.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">{t("Loaded")} {allSlips.length} {t("slips")}</p>
            <button className="btn" onClick={handlePrint}><Printer size={16} /> {t("Print")} ({allSlips.length})</button>
          </div>
        )}
      </div>
      {allSlips.length > 0 && (
        <div className="slip-grid">
          {allSlips.map((s) => <VoterSlip key={s.id} data={{ ...s, settings }} />)}
        </div>
      )}
      {allSlips.length > 0 && allSlips.length % 200 === 0 && (
        <div className="no-print text-center">
          <button className="btn-ghost" disabled={loading} onClick={() => loadPage(page + 1)}>{loading ? t("Loading…") : t("Load next 200")}</button>
        </div>
      )}
      {allSlips.length === 0 && !loading && <Empty text={t("No slips loaded. Set filters and click Load slips.")} />}
    </div>
  );
}