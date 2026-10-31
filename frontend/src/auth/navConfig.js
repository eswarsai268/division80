import { Building2, CalendarDays, FileDown, FileUp, Home, Link2, Lock, MessageCircle, Settings, ShieldCheck, UserCog, Users } from "lucide-react";

/** Navigation per role. `main` = bottom bar, `more` = the "More" sheet. */
export const NAV = {
  ADMIN: {
    main: [{ to: "/admin/dashboard", label: "Dashboard", icon: Home }, { to: "/admin/booths", label: "Booths", icon: Building2 }, { to: "/admin/citizens", label: "Citizens", icon: Users }],
    more: [{ to: "/admin/assignments", label: "Assignments", icon: Link2 }, { to: "/admin/users", label: "Users", icon: UserCog }, { to: "/admin/import", label: "Import", icon: FileUp }, { to: "/admin/exports", label: "Exports", icon: FileDown },
      { to: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle }, { to: "/admin/events", label: "Events", icon: CalendarDays }, { to: "/admin/dead-people", label: "Dead people", icon: Lock }, { to: "/admin/settings", label: "Settings", icon: Settings }],
  },
  BOOTH_MEMBER: {
    main: [{ to: "/booth/dashboard", label: "Dashboard", icon: Home }, { to: "/booth/households", label: "Houses", icon: Users }, { to: "/booth/verifications", label: "Verified", icon: ShieldCheck }, { to: "/events", label: "Events", icon: CalendarDays }],
    more: [],
  },
};
