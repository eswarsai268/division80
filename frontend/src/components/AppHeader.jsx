import { Bike, LogOut } from "lucide-react";
import { APP_NAME } from "../utils/constants";

export default function AppHeader({ me, onLogout }) {
  return (
    <header className="app-top-nav">
      <div className="app-top-nav-inner">
        <div className="flex min-w-0 items-center gap-2">
          <Bike className="shrink-0 text-stone-900" size={25} />
          <div className="min-w-0">
            <p className="app-brand-name">{APP_NAME}</p>
            <p className="truncate text-xs text-stone-800">{me.fullName} · {me.role.replace("_", " ")}</p>
          </div>
        </div>
        <button onClick={onLogout} className="flex shrink-0 items-center gap-1 rounded-full border border-amber-700/20 bg-amber-50 px-3 py-2 text-sm font-semibold text-stone-900 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900" aria-label="Log out"><LogOut size={16} /> Logout</button>
      </div>
    </header>
  );
}
