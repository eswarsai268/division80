"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeImportedPhone = normalizeImportedPhone;
exports.toWhatsAppRecipient = toWhatsAppRecipient;

function normalizeImportedPhone(value) {
    const raw = String(value ?? "").trim();
    if (!raw)
        return null;
    const normalized = raw.replace(/[()\s-]/g, "");
    if (raw.length > 32 || !/^\+?[1-9]\d{7,14}$/.test(normalized))
        return undefined;
    return normalized;
}

function toWhatsAppRecipient(value, countryCode) {
    const raw = String(value ?? "").trim();
    if (!raw || raw.length > 32 || !/^\+?[\d\s()-]+$/.test(raw))
        return null;
    let digits = raw.replace(/[+\s()-]/g, "");
    if (raw.startsWith("+")) {
        if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
        return digits;
    }
    if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
    if (digits.startsWith(countryCode) && digits.length > 10 && digits.length <= 15)
        return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
    if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
    const international = `${countryCode}${digits}`;
    return /^[1-9]\d{7,14}$/.test(international) ? international : null;
}
