import { Link } from "react-router-dom";
import LoginForm from "../../forms/LoginForm";
import AuthLayout from "../../layouts/AuthLayout";
import { PORTALS } from "../../utils/constants";

export default function LoginPage({ portal }) {
  return (
    <AuthLayout title={`Sign in as ${PORTALS[portal]}`} subtitle="Access your secure MyTDP workspace.">
      <LoginForm portal={portal} />
      <div className="mt-4 space-y-1 text-center text-sm">
        {portal === "USER" && <p>New here? <Link to="/register" className="text-brand-600 underline">Create account</Link></p>}
        <p className="text-slate-500">
          {portal !== "USER" && <Link to="/login" className="underline">Citizen login</Link>}
          {portal !== "BOOTH_MEMBER" && <Link to="/booth/login" className="ml-2 underline">Booth member login</Link>}
          {portal !== "ADMIN" && <Link to="/admin/login" className="ml-2 underline">Admin login</Link>}
        </p>
      </div>
    </AuthLayout>
  );
}
