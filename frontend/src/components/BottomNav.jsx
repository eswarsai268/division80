import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }) => `flex flex-col items-center text-xs ${isActive ? "text-brand-600" : "text-slate-500"}`;

export default function BottomNav({ main, more }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && more.length > 0 && (
        <div className="fixed inset-x-0 bottom-14 border-t border-brand-100 bg-white shadow-lg">
          <div className="mx-auto grid max-w-3xl grid-cols-4 gap-2 p-3">
            {more.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={linkClass}><Icon size={20} />{label}</NavLink>)}
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 border-t border-brand-100 bg-white">
        <div className="mx-auto flex max-w-3xl justify-around py-2">
          {main.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={linkClass}><Icon size={20} />{label}</NavLink>)}
          {more.length > 0 && <button onClick={() => setOpen(!open)} className="flex flex-col items-center text-xs text-slate-500" aria-label="More pages"><MoreHorizontal size={20} />More</button>}
        </div>
      </nav>
    </>
  );
}
