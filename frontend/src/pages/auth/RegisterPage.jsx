import { Link } from "react-router-dom";
import RegisterForm from "../../forms/RegisterForm";
import AuthLayout from "../../layouts/AuthLayout";

export default function RegisterPage() {
  return (
    <AuthLayout title="Create account">
      <RegisterForm />
      <p className="mt-4 text-center text-sm"><Link to="/login" className="text-brand-600 underline">Back to sign in</Link></p>
    </AuthLayout>
  );
}
