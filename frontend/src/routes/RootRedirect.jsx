import { Navigate } from "react-router-dom";
import { homeFor } from "../auth/paths";
import { useMe } from "../auth/useMe";

export default function RootRedirect() {
  const { data: me, isLoading, error } = useMe();
  if (isLoading) return null;
  if (!me && typeof navigator !== "undefined" && !navigator.onLine) {
    // Stay put while offline instead of bouncing to login.
    return null;
  }
  return <Navigate to={me ? homeFor(me.role) : "/booth/login"} replace />;
}









