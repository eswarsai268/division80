"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhone = normalizePhone;
function normalizePhone(value) {
    return String(value ?? "").trim().replace(/[()\s-]/g, "");
}
