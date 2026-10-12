import ComplaintForm from "../../forms/ComplaintForm";
import Title from "../../components/Title";
import { t } from "../../i18n";

export default function NewComplaint() {
  return <div><Title>{t("New complaint")}</Title><ComplaintForm /></div>;
}
