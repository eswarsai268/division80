import { t } from "../i18n";

const Title = ({ children }) => <h1 className="mb-3 text-lg font-semibold text-brand-900">{typeof children === "string" ? t(children) : children}</h1>;

export default Title;
