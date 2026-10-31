import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Sanscript from "@indic-transliteration/sanscript";

function toTelugu(text) {
  if (!text) return "";
  try { return Sanscript.t(String(text).toLowerCase(), "itrans", "telugu"); }
  catch { return ""; }
}

export default function VoterSlip({ data }) {
  const s = data.settings || {};
  const banner = s.bannerPath || "/slip/banner.png";
  const headerBanner = s.headerBannerPath;
  const templateUrl = s.templateUrl;
  const accent = s.accentColor || "#1e3a8a";
  const [bannerOk, setBannerOk] = useState(true);
  const [headerOk, setHeaderOk] = useState(true);
  const [templateOk, setTemplateOk] = useState(true);
  const voterNameTe = data.voterName ? toTelugu(data.voterName) : "";
  const fatherNameTe = data.fatherName ? toTelugu(data.fatherName) : "";
  const cardStyle = templateUrl && templateOk
    ? { "--slip-accent": accent, backgroundImage: `url(${templateUrl})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat", backgroundColor: "transparent" }
    : { "--slip-accent": accent };
  return (
    <div className="voter-slip-card" style={cardStyle}>
      {templateUrl && templateOk && <img src={templateUrl} alt="" style={{ display: "none" }} onError={() => setTemplateOk(false)} />}
      {headerOk && headerBanner && (
        <img src={headerBanner} alt="" className="slip-header-banner" onError={() => setHeaderOk(false)} />
      )}
      <div className="slip-top">
        <div className="slip-small">డిజిటల్ ఓటరు స్లిప్</div>
        <div className="slip-title">{s.slipTitle || "విజయవాడ నగర పాలక సంస్థ • ఫోటో ఓటర్ల జాబితా 2026"}</div>
        <div className="slip-sub">వార్డు నెంబరు / Ward : {s.wardNumber || "79"}</div>
        <div className="slip-ward-row">
          <span>వార్డు ఓ.జా.వ.సం.</span>
          <span className="slip-sno-box">{data.serialNo ?? "—"}</span>
        </div>
      </div>
      <div className="slip-details">
        <div className="slip-row"><span className="slip-label">ఓటరు పేరు / Voter Name</span><span className="slip-dots" /><span className="slip-value">{data.voterName ?? "—"}</span></div>
        {voterNameTe && <div className="slip-row slip-telugu-name"><span className="slip-dots" /><span className="slip-value slip-telugu-text">{voterNameTe}</span></div>}
        <div className="slip-row"><span className="slip-label">తండ్రి పేరు / Father's Name</span><span className="slip-dots" /><span className="slip-value">{data.fatherName ?? "—"}</span></div>
        {fatherNameTe && <div className="slip-row slip-telugu-name"><span className="slip-dots" /><span className="slip-value slip-telugu-text">{fatherNameTe}</span></div>}
        {(data.age != null || data.gender) && (
          <div className="slip-row"><span className="slip-label">వయస్సు / లింగము / Age / Gender</span><span className="slip-dots" /><span className="slip-value">{[data.age != null ? data.age : null, data.gender && data.gender !== "UNKNOWN" ? data.gender : null].filter(Boolean).join(" / ") || "—"}</span></div>
        )}
        <div className="slip-row"><span className="slip-label">ఇంటి సంఖ్య / Door No</span><span className="slip-dots" /><span className="slip-value">{data.doorNo ?? "—"}</span></div>
        <div className="slip-row"><span className="slip-label">ఓటరు ఐడి కార్డు నెం. / Voter ID</span><span className="slip-dots" /><span className="slip-value">{data.voterId ?? "—"}</span></div>
      </div>
      <div className="slip-polling-bar">
        <span>📅</span>
        <span>పోలింగ్ తేదీ: {s.pollingDateText || "01-11-2026, ఆదివారం"}</span>
      </div>
      <div className="slip-scan-row">
        <div className="slip-polling-place">
          <div className="slip-station-code">{data.pollingStation || "Not available"}</div>
          <div className="slip-station-label">పోలింగ్ కేంద్రం / Polling Station</div>
          <div className="slip-address">{data.pollingAddress || "Not available"}</div>
        </div>
        <div className="slip-qr">
          {data.voterId ? <QRCodeSVG value={String(data.voterId)} size={96} /> : null}
          <div className="slip-qr-text">{data.voterId ?? ""}</div>
        </div>
      </div>
      <div className="slip-footer">
        <span>వయస్సు లెక్కింపు తేదీ: {s.ageReferenceDate || "01-01-2026"}</span>
        <span>ప్రచురణ తేదీ: {s.publicationDate || "22-09-2026"}</span>
      </div>
      <div className="slip-notice">అనధికారిక సమాచార స్లిప్ — పోలింగ్ కేంద్రంలో అధికారిక జాబితాతో సరిచూసుకోండి. పోలింగ్ రోజున ఓటరు ఐడి లేదా ఆమోదిత గుర్తింపు కార్డు తీసుకురండి.</div>
      {bannerOk && (
        <img src={banner} alt="" className="slip-banner" onError={() => setBannerOk(false)} />
      )}
    </div>
  );
}