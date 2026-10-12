import { Link } from "react-router-dom";
import RegisterForm from "../../forms/RegisterForm";
import AuthLayout from "../../layouts/AuthLayout";
import { t, useLanguage } from "../../i18n";

export default function RegisterPage() {
  useLanguage();
  return (
    <AuthLayout title={t("Create account")}>
      <RegisterForm />
      <p className="mt-4 text-center text-sm"><Link to="/login" className="text-brand-600 underline">{t("Back to sign in")}</Link></p>
    </AuthLayout>
  );
}
