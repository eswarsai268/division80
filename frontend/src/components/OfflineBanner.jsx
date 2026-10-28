import { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (online) return null;
  return (
    <div role="status" aria-live="polite" style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      background: "#b45309", color: "#fff", textAlign: "center",
      padding: "6px 12px", fontSize: "13px", fontWeight: 600,
    }}>
      You are offline. Cached data may be shown; new changes will sync when connected.
    </div>
  );
}