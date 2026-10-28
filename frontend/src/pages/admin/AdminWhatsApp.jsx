import { useEffect, useMemo, useState } from "react";
import Async from "../../components/Async";
import Badge from "../../components/Badge";
import Empty from "../../components/Empty";
import ErrorBox from "../../components/ErrorBox";
import Title from "../../components/Title";
import { post } from "../../api/client";
import { useAct } from "../../hooks/useAct";
import { useGet } from "../../hooks/useGet";
import { fmt } from "../../utils/format";
import { t } from "../../i18n";

export default function AdminWhatsApp() {
    const status = useGet(["admin", "whatsapp", "status"], "/admin/whatsapp/status");
    const templates = useGet(["admin", "whatsapp", "templates"], "/admin/whatsapp/templates", { enabled: status.data?.configured === true });
    const campaigns = useGet(["admin", "whatsapp", "campaigns"], "/admin/whatsapp/campaigns", { refetchInterval: 5000 });
    const [templateKey, setTemplateKey] = useState("");
    const [parameterValues, setParameterValues] = useState([]);
    const [permissionConfirmed, setPermissionConfirmed] = useState(false);
    const available = templates.data ?? [];
    const selected = useMemo(() => available.find((item) => `${item.name}:${item.language}` === templateKey), [available, templateKey]);
    const send = useAct(() => post("/admin/whatsapp/campaigns", {
        templateName: selected.name,
        language: selected.language,
        parameters: parameterValues,
        permissionConfirmed,
    }));
    useEffect(() => {
        if (!send.data) return;
        setTemplateKey("");
        setParameterValues([]);
        setPermissionConfirmed(false);
    }, [send.data]);

    const chooseTemplate = (value) => {
        setTemplateKey(value);
        const next = available.find((item) => `${item.name}:${item.language}` === value);
        setParameterValues(Array.from({ length: next?.bodyParameterCount ?? 0 }, () => ""));
        send.reset();
    };
    const submit = () => {
        if (!selected || !permissionConfirmed || parameterValues.some((value) => !value.trim())) return;
        const prompt = `Queue this approved WhatsApp template for ${status.data?.eligibleRecipients ?? 0} eligible contacts? The worker sends it in the background.`;
        if (window.confirm(t(prompt))) send.mutate();
    };

    return <div className="space-y-3">
        <Title>{t("WhatsApp messages")}</Title>
        <div className="card space-y-2">
            <p className="text-sm text-slate-600">{t("Send an approved WhatsApp template to valid phone numbers from confirmed CSV imports. Contacts without a valid number are excluded.")}</p>
            <p className="text-xs text-slate-500">{t("A successful API acceptance does not confirm delivery. Use templates approved for your business and message purpose.")}</p>
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{t("This application processes voter and election-related roster data. WhatsApp restricts some political and election-related uses of its Business Platform. Confirm that your organization and intended use are eligible with Meta or an authorized platform partner before configuring or sending campaigns. Template approval and recipient permission do not override those restrictions.")}</p>
            <Async q={status}>{(data) => <>
                {data.configured ? <>
                    <div className="rounded-lg bg-slate-50 p-3 text-sm">
                        {t("Eligible contacts")}: <strong>{data.eligibleRecipients.toLocaleString()}</strong>
                        {data.invalidPhoneCount > 0 && <span className="ml-2 text-amber-800">{t("Invalid phone numbers excluded")}: {data.invalidPhoneCount.toLocaleString()}</span>}
                    </div>
                    {data.recipientLimitReached && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t("The roster exceeds the current 50,000 contact campaign limit. A campaign cannot be queued until the campaign size is narrowed.")}</p>}
                    <Async q={templates}>{(items) => <>
                        <label className="block text-sm font-medium" htmlFor="wa-template">{t("Approved template")}</label>
                        <select id="wa-template" className="input" value={templateKey} onChange={(event) => chooseTemplate(event.target.value)}>
                            <option value="">{t("Choose a template")}</option>
                            {items.filter((item) => item.supported).map((item) => <option key={`${item.name}:${item.language}`} value={`${item.name}:${item.language}`}>{item.title}</option>)}
                        </select>
                        {selected && <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{selected.bodyText}</div>}
                        {selected && parameterValues.map((value, index) => <label className="block text-sm" key={index}>
                            {t("Template value")} {index + 1}
                            <input className="input mt-1" maxLength={1024} value={value} onChange={(event) => setParameterValues((old) => old.map((item, i) => i === index ? event.target.value : item))} />
                        </label>)}
                        {items.length > 0 && items.every((item) => !item.supported) && <p className="text-sm text-amber-800">{t("No supported approved text templates are available. Templates with media or non-body parameters are not supported by this sender yet.")}</p>}
                        <label className="flex gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={permissionConfirmed} onChange={(event) => setPermissionConfirmed(event.target.checked)} />
                            <span>{t("I confirm these contacts agreed to receive this message, and the template fits its approved purpose.")}</span>
                        </label>
                        {send.error && <ErrorBox error={send.error} />}
                        {send.data && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{t("Campaign queued")}: {send.data.recipientCount.toLocaleString()} {t("contacts")}; {t("excluded")}: {send.data.skippedCount.toLocaleString()}.</p>}
                        <button className="btn w-full" disabled={!selected || !permissionConfirmed || parameterValues.some((value) => !value.trim()) || !status.data?.eligibleRecipients || status.data?.recipientLimitReached || send.isPending || Boolean(send.data)} onClick={submit}>
                            {send.isPending ? t("Queuing…") : t("Queue template campaign")}
                        </button>
                    </>}</Async>
                </> : <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    <p>{t("WhatsApp sending is not configured on the server yet.")}</p>
                    <p className="mt-1">{t("Configure WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID, and WHATSAPP_API_VERSION on both the API and worker services.")}</p>
                </div>}
            </>}</Async>
        </div>
        {campaigns.error && <ErrorBox error={campaigns.error} />}
        <h2 className="font-semibold text-brand-900">{t("Recent campaigns")}</h2>
        {campaigns.data?.length ? campaigns.data.map((campaign) => <div className="card flex flex-wrap items-center justify-between gap-3 text-sm" key={campaign.id}>
            <div><p className="font-medium">{campaign.templateName}</p><p className="text-xs text-slate-500">{fmt(campaign.createdAt)} · {campaign.acceptedCount.toLocaleString()} {t("accepted by WhatsApp")}, {campaign.failedCount.toLocaleString()} {t("failed")}, {campaign.skippedCount.toLocaleString()} {t("skipped")}</p></div>
            <Badge s={campaign.status} />
        </div>) : <Empty text="No campaigns yet." />}
        <p className="text-xs text-slate-500">{t("Campaign totals are retained. Recipient phone numbers are removed immediately when their source import is deleted; remaining snapshots expire after 30 days.")}</p>
    </div>;
}
