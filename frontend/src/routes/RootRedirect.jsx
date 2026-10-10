import { Navigate } from "react-router-dom";
import { homeFor } from "../auth/paths";
import { useMe } from "../auth/useMe";

export default function RootRedirect() {
  const { data: me, isLoading } = useMe();
  if (isLoading) return null;
  return <Navigate to={me ? homeFor(me.role) : "/login"} replace />;
}
