import { Bike, LogOut } from "lucide-react";
import { APP_NAME } from "../utils/constants";

export default function AppHeader({ me, onLogout }) {
  return (
    <header className="flex items-center justify-between border-b border-amber-300 bg-[#ffc400] px-4 py-3 text-stone-950 shadow-sm">
      <div className="flex items-center gap-2">
        <Bike className="text-slate-800" size={25} />
        <div>
        <p className="app-brand-name">{APP_NAME}</p>
        <p className="text-xs text-stone-700">{me.fullName} · {me.role.replace("_", " ")}</p>
        </div>
      </div>
      <button onClick={onLogout} className="flex items-center gap-1 rounded-full bg-white/50 px-3 py-2 text-sm font-medium hover:bg-white/75" aria-label="Log out"><LogOut size={16} /> Logout</button>
    </header>
  );
}
