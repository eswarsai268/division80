"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeImportedPhone = normalizeImportedPhone;

function normalizeImportedPhone(value) {
    const raw = String(value ?? "").trim();
    if (!raw)
        return null;
    const normalized = raw.replace(/[()\s-]/g, "");
    if (raw.length > 32 || !/^\+?[1-9]\d{7,14}$/.test(normalized))
        return undefined;
    return normalized;
}
