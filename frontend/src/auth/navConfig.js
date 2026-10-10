import { Building2, CalendarDays, ClipboardList, FileDown, FileUp, Home, Link2, ListChecks, Repeat, ScrollText, Settings, ShieldCheck, User, UserCog, Users } from "lucide-react";

/** Navigation per role. `main` = bottom bar, `more` = the "More" sheet. */
export const NAV = {
  ADMIN: {
    main: [{ to: "/admin/dashboard", label: "Dashboard", icon: Home }, { to: "/admin/booths", label: "Booths", icon: Building2 }, { to: "/admin/complaints", label: "Complaints", icon: ClipboardList }, { to: "/admin/citizens", label: "Citizens", icon: Users }],
    more: [{ to: "/admin/assignments", label: "Assignments", icon: Link2 }, { to: "/admin/users", label: "Users", icon: UserCog }, { to: "/admin/import", label: "Import", icon: FileUp }, { to: "/admin/exports", label: "Exports", icon: FileDown },
      { to: "/admin/events", label: "Events", icon: CalendarDays }, { to: "/admin/cross-booth", label: "Cross-booth verification", icon: Repeat }, { to: "/admin/audit-logs", label: "Audit logs", icon: ScrollText }, { to: "/admin/settings", label: "Settings", icon: Settings }, { to: "/profile", label: "Profile", icon: User }],
  },
  BOOTH_MEMBER: {
    main: [{ to: "/booth/dashboard", label: "Dashboard", icon: Home }, { to: "/booth/households", label: "Houses", icon: Users }, { to: "/booth/verifications", label: "Verified", icon: ShieldCheck }, { to: "/booth/cross-booth", label: "Cross-booth", icon: Repeat }],
    more: [{ to: "/booth/complaints", label: "Complaints", icon: ListChecks }, { to: "/profile", label: "Profile", icon: User }],
  },
  USER: {
    main: [{ to: "/home", label: "Home", icon: Home }, { to: "/complaints", label: "Complaints", icon: ClipboardList }, { to: "/events", label: "Events", icon: CalendarDays }, { to: "/profile", label: "Profile", icon: User }],
    more: [],
  },
};
