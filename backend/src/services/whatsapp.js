"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWhatsAppStatus = getWhatsAppStatus;
exports.listApprovedTemplates = listApprovedTemplates;
exports.createTemplateCampaign = createTemplateCampaign;
exports.listTemplateCampaigns = listTemplateCampaigns;
exports.getTemplateCampaign = getTemplateCampaign;
const crypto_1 = require("crypto");
const pool_1 = require("../db/pool");
const env_1 = require("../config/env");
const errors_1 = require("../errors");
const importPhone_1 = require("../utils/importPhone");
const whatsapp_templates_1 = require("./whatsapp_templates");

const MAX_RECIPIENTS = 50_000;
const settings = () => ({
    token: env_1.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: env_1.env.WHATSAPP_PHONE_NUMBER_ID,
    businessAccountId: env_1.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    version: env_1.env.WHATSAPP_API_VERSION,
    countryCode: env_1.env.WHATSAPP_DEFAULT_COUNTRY_CODE,
});
const configured = (s) => Boolean(s.token && s.phoneNumberId && s.businessAccountId && s.version);

const toWhatsAppRecipient = importPhone_1.toWhatsAppRecipient;

function describeTemplate(template) {
    const components = Array.isArray(template.components) ? template.components : [];
    const body = components.find((component) => component.type === "BODY");
    const bodyText = String(body?.text ?? "");
    const placeholders = [...bodyText.matchAll(/\{\{[^}]+\}\}/g)].map((match) => match[0]);
    const numericPlaceholdersOnly = placeholders.every((value) => /^\{\{\d+\}\}$/.test(value));
    const matches = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)];
    const indexes = [...new Set(matches.map((match) => Number(match[1])))].sort((a, b) => a - b);
    const otherDynamic = components.filter((component) => component.type !== "BODY")
        .some((component) => /\{\{\d+\}\}/.test(JSON.stringify(component)) || component.format === "IMAGE" || component.format === "VIDEO" || component.format === "DOCUMENT");
    const sequential = indexes.every((index, position) => index === position + 1);
    return {
        name: template.name,
        language: template.language,
        category: template.category,
        bodyText,
        bodyParameterCount: indexes.length,
        supported: Boolean(body) && template.status === "APPROVED" && !otherDynamic && numericPlaceholdersOnly && sequential,
    };
}

async function graph(path, init = {}) {
    const s = settings();
    if (!configured(s)) throw new errors_1.AppError(503, "WHATSAPP_NOT_CONFIGURED", "WhatsApp Business Platform credentials are not configured on the server");
    let response;
    try {
        response = await fetch(`https://graph.facebook.com/${s.version}/${path}`, {
            ...init,
            signal: AbortSignal.timeout(15_000),
            headers: { Authorization: `Bearer ${s.token}`, ...(init.headers ?? {}) },
        });
    }
    catch {
        throw new errors_1.AppError(502, "WHATSAPP_UNAVAILABLE", "Could not reach WhatsApp. Try again shortly.");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const code = payload?.error?.code;
        throw new errors_1.AppError(502, "WHATSAPP_PROVIDER_ERROR", `WhatsApp rejected the request${code ? ` (code ${String(code).slice(0, 20)})` : ""}`);
    }
    return payload;
}

async function getWhatsAppStatus(c) {
    const s = settings();
    const rows = await (0, pool_1.query)(`SELECT pc.phone FROM import_phone_contacts pc
        JOIN import_jobs ij ON ij.id = pc.import_job_id AND ij.organization_id = pc.organization_id
        WHERE pc.organization_id = ? AND ij.status = 'COMMITTED' AND ij.deleted_at IS NULL
        ORDER BY pc.id LIMIT ?`, [c.user.organizationId, MAX_RECIPIENTS + 1]);
    const eligibleNumbers = new Set();
    const invalidNumbers = new Set();
    for (const row of rows) {
        const normalized = toWhatsAppRecipient(row.phone, s.countryCode);
        if (normalized) eligibleNumbers.add(normalized);
        else invalidNumbers.add(String(row.phone));
    }
    return {
        configured: configured(s),
        eligibleRecipients: eligibleNumbers.size,
        invalidPhoneCount: invalidNumbers.size,
        recipientLimitReached: rows.length > MAX_RECIPIENTS,
        countryCode: s.countryCode,
    };
}

async function listApprovedTemplates() {
    const s = settings();
    const params = new URLSearchParams({ fields: "name,status,language,category,components", limit: "100" });
    const response = await graph(`${s.businessAccountId}/message_templates?${params}`);
    return (Array.isArray(response.data) ? response.data : [])
        .filter((template) => template.status === "APPROVED")
        .map(describeTemplate)
        .filter((template) => {
            const expected = Object.values(whatsapp_templates_1.WHATSAPP_TEMPLATES)
                .find((item) => item.name === template.name && item.language === template.language);
            return template.supported && expected?.body === template.bodyText;
        })
        .map((template) => ({
            ...template,
            title: whatsapp_templates_1.WHATSAPP_TEMPLATES[template.name].title,
        }));
}

async function createTemplateCampaign(c, input) {
    const s = settings();
    if (!configured(s)) throw new errors_1.AppError(503, "WHATSAPP_NOT_CONFIGURED", "WhatsApp Business Platform credentials are not configured on the server");
    if (input.permissionConfirmed !== true)
        throw new errors_1.AppError(422, "CONTACT_PERMISSION_REQUIRED", "Confirm that recipients agreed to receive this message");
    const templates = await listApprovedTemplates();
    const template = templates.find((item) => item.name === input.templateName && item.language === input.language);
    if (!template || !template.supported)
        throw new errors_1.AppError(422, "UNSUPPORTED_TEMPLATE", "Choose an approved text template without media or unsupported placeholders");
    if (input.parameters.length !== template.bodyParameterCount)
        throw new errors_1.AppError(422, "INVALID_TEMPLATE_PARAMETERS", `This template requires ${template.bodyParameterCount} body value(s)`);

    const phones = await (0, pool_1.query)(`SELECT pc.id AS phoneContactId, pc.phone FROM import_phone_contacts pc
        JOIN import_jobs ij ON ij.id = pc.import_job_id AND ij.organization_id = pc.organization_id
        WHERE pc.organization_id = ? AND ij.status = 'COMMITTED' AND ij.deleted_at IS NULL
        ORDER BY pc.id LIMIT ?`, [c.user.organizationId, MAX_RECIPIENTS + 1]);
    if (phones.length > MAX_RECIPIENTS)
        throw new errors_1.AppError(413, "RECIPIENT_LIMIT", `A campaign is limited to ${MAX_RECIPIENTS} recipients; narrow the roster and retry`);
    const distinct = new Map();
    for (const row of phones) {
        const phone = toWhatsAppRecipient(row.phone, s.countryCode);
        if (phone && !distinct.has(phone)) distinct.set(phone, { phoneContactId: row.phoneContactId, phone });
    }
    const recipients = [...distinct.values()];
    if (!recipients.length)
        throw new errors_1.AppError(422, "NO_RECIPIENTS", "No eligible records have a valid phone number");

    const id = (0, crypto_1.randomUUID)();
    await (0, pool_1.tx)(async (conn) => {
        await (0, pool_1.exec)(`INSERT INTO whatsapp_campaign_jobs
          (id, organization_id, created_by, template_name, template_language, template_parameters, recipient_count, invalid_phone_count, skipped_count)
          VALUES (?,?,?,?,?,?,?,?,?)`, [id, c.user.organizationId, c.user.id, template.name, template.language, JSON.stringify(input.parameters), recipients.length, phones.length - recipients.length, phones.length - recipients.length], conn);
        for (let offset = 0; offset < recipients.length; offset += 1000) {
            const batch = recipients.slice(offset, offset + 1000);
            await (0, pool_1.exec)(`INSERT INTO whatsapp_campaign_recipients (id, job_id, phone_contact_id, recipient_phone)
              VALUES ${batch.map(() => "(?,?,?,?)").join(",")}`,
            batch.flatMap((row) => [(0, crypto_1.randomUUID)(), id, row.phoneContactId, row.phone]), conn);
        }
    });
    return { id, status: "PENDING", templateName: template.name, recipientCount: recipients.length, skippedCount: phones.length - recipients.length };
}

const CAMPAIGN_COLUMNS = `id, template_name AS templateName, template_language AS language, status,
  recipient_count AS recipientCount, accepted_count AS acceptedCount, failed_count AS failedCount,
  skipped_count AS skippedCount, created_at AS createdAt, finished_at AS finishedAt`;
async function listTemplateCampaigns(c) {
    return (0, pool_1.query)(`SELECT ${CAMPAIGN_COLUMNS} FROM whatsapp_campaign_jobs
        WHERE organization_id = ? ORDER BY created_at DESC LIMIT 30`, [c.user.organizationId]);
}
async function getTemplateCampaign(c, id) {
    const job = (await (0, pool_1.query)(`SELECT ${CAMPAIGN_COLUMNS} FROM whatsapp_campaign_jobs WHERE id = ? AND organization_id = ?`, [id, c.user.organizationId]))[0];
    if (!job) throw (0, errors_1.notFound)();
    return job;
}

exports.toWhatsAppRecipient = toWhatsAppRecipient;
exports.describeTemplate = describeTemplate;
exports.whatsappConfigured = () => configured(settings());
exports.getWhatsAppSettingsForWorker = settings;
