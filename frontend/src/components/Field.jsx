import { t } from "../i18n";

const Field = ({ label, children }) => <label className="block"><span className="label">{t(label)}</span>{children}</label>;

export default Field;
