import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import Async from "../../components/Async";
import VoterSlip from "../../components/VoterSlip";
import { api } from "../../api/client";
import { t } from "../../i18n";

export default function PrintSlip() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ["slip", "voter", id], queryFn: () => api(`/slips/voter/${id}`) });
  return (
    <div className="print-slip-page space-y-4">
      <div className="no-print flex items-center justify-between">
        <h1 className="text-lg font-bold">{t("Voter slip")}</h1>
        <button className="btn" onClick={() => window.print()}><Printer size={16} /> {t("Print")}</button>
      </div>
      <Async q={q}>{(d) => (
        <div className="slip-grid">
          <VoterSlip data={d} />
        </div>
      )}</Async>
    </div>
  );
}