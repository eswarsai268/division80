import { useEffect, useState } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { t } from "../i18n";

const linkClass = ({ isActive }) => `app-nav-link ${isActive ? "is-active" : ""}`;

export default function BottomNav({ main = [], more = [] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open)
      return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape")
        setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      {open && more.length > 0 && (
        <div className="app-more-layer">
          <button className="app-more-backdrop" onClick={() => setOpen(false)} aria-label={t("Close menu")} tabIndex={-1} />
          <section className="app-more-sheet" role="dialog" aria-modal="true" aria-labelledby="more-menu-title">
            <div className="app-more-heading">
              <div>
                <h2 id="more-menu-title">{t("More")}</h2>
                <p>{t("Tools and account")}</p>
              </div>
              <button className="app-more-close" onClick={() => setOpen(false)} aria-label={t("Close menu")}><X size={19} /></button>
            </div>
            <div className="app-more-grid">
              {more.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={() => setOpen(false)} className={linkClass}>
                  <span className="app-nav-icon"><Icon size={20} strokeWidth={1.8} /></span>
                  <span>{t(label)}</span>
                </NavLink>
              ))}
            </div>
          </section>
        </div>
      )}
      <nav className="app-bottom-nav" aria-label={t("Main navigation")}>
        <div className="app-bottom-nav-inner">
          {main.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)} className={linkClass}>
              <span className="app-nav-icon"><Icon size={20} strokeWidth={1.8} /></span>
              <span>{t(label)}</span>
            </NavLink>
          ))}
          {more.length > 0 && (
            <button
              onClick={() => setOpen(!open)}
              className={`app-nav-link ${open ? "is-active" : ""}`}
              aria-label={t("More pages")}
              aria-expanded={open}
              aria-controls="more-menu-title"
            >
              <span className="app-nav-icon"><MoreHorizontal size={20} strokeWidth={1.8} /></span>
              <span>{t("More")}</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
