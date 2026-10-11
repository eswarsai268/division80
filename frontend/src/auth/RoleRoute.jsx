import { Navigate, Outlet } from "react-router-dom";
import AccessDenied from "../pages/AccessDenied";
import { useMe } from "./useMe";

/** UX-only guard. The API is the authority: a 403 shows "Access denied" and never bounces to login. */
export default function RoleRoute({ roles }) {
  const { data: me, isLoading, error } = useMe();
  if (isLoading) return <div className="p-8 text-center text-slate-500">Loading…</div>;
  if (!me || error?.status === 401) return <Navigate to="/login" replace />;
  if (!roles.includes(me.role)) return <AccessDenied role={me.role} />;
  return <Outlet />;
}
