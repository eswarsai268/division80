"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signedUrl = void 0;
exports.verifySignature = verifySignature;
exports.saveAttachment = saveAttachment;
exports.listAttachmentsOwn = listAttachmentsOwn;
exports.listAttachmentsAdmin = listAttachmentsAdmin;
exports.resolveFile = resolveFile;
const crypto_1 = require("crypto");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const env_1 = require("../config/env");
const pool_1 = require("../db/pool");
const errors_1 = require("../errors");
const audit_1 = require("./audit");
const complaints_1 = require("./complaints");
const DIR = path_1.default.resolve(env_1.env.UPLOAD_DIR);
const SECRET = (0, crypto_1.createHash)("sha256").update("files:" + env_1.env.JWT_ACCESS_SECRET).digest();
const MAX_BYTES = 5 * 1024 * 1024, MAX_PER_COMPLAINT = 3, URL_TTL_S = 300;
const TYPES = {
    "image/jpeg": { ext: "jpg", magic: [0xff, 0xd8, 0xff] },
    "image/png": { ext: "png", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
};
const sign = (id, exp) => (0, crypto_1.createHmac)("sha256", SECRET).update(`${id}.${exp}`).digest("base64url");
const signedUrl = (id) => { const exp = Math.floor(Date.now() / 1000) + URL_TTL_S; return `/api/v1/files/${id}?exp=${exp}&sig=${sign(id, exp)}`; };
exports.signedUrl = signedUrl;
function verifySignature(id, exp, sig) {
    if (!Number.isFinite(exp) || exp < Date.now() / 1000)
        return false;
    const a = Buffer.from(sign(id, exp)), b = Buffer.from(sig);
    return a.length === b.length && (0, crypto_1.timingSafeEqual)(a, b);
}
/** Owner-only. Client filename is never used; the object name is server-generated; the real file type is verified by magic bytes. */
async function saveAttachment(c, complaintId, mime, body) {
    await (0, complaints_1.getOwn)(c, complaintId);
    const t = TYPES[mime];
    if (!t || !Buffer.isBuffer(body))
        throw new errors_1.AppError(415, "UNSUPPORTED_MEDIA", "Only JPEG or PNG images are allowed");
    if (body.length < 16 || body.length > MAX_BYTES)
        throw new errors_1.AppError(413, "FILE_SIZE", "Image must be under 5 MB");
    if (!t.magic.every((b, i) => body[i] === b))
        throw new errors_1.AppError(422, "FILE_TYPE_MISMATCH", "File content does not match its type");
    const n = Number((await (0, pool_1.query)("SELECT COUNT(*) n FROM attachments WHERE complaint_id = ?", [complaintId]))[0].n);
    if (n >= MAX_PER_COMPLAINT)
        throw (0, errors_1.conflict)(`At most ${MAX_PER_COMPLAINT} photos per complaint`);
    const id = (0, crypto_1.randomUUID)(), key = `${(0, crypto_1.randomUUID)()}.${t.ext}`;
    await promises_1.default.mkdir(DIR, { recursive: true, mode: 0o700 });
    await promises_1.default.writeFile(path_1.default.join(DIR, key), body, { mode: 0o600, flag: "wx" });
    // No antivirus engine is wired in: validated images are marked CLEAN. Plug a scanner in here (set PENDING, scan in worker).
    await (0, pool_1.exec)("INSERT INTO attachments (id, complaint_id, object_key, mime_type, size_bytes, scan_status) VALUES (?,?,?,?,?, 'CLEAN')", [id, complaintId, key, mime, body.length]);
    await (0, audit_1.audit)({ actorId: c.user.id, action: "ATTACHMENT_UPLOAD", resourceType: "COMPLAINT", resourceId: complaintId, outcome: "SUCCESS", requestId: c.requestId });
    return { id };
}
const withUrls = (rows) => rows.map((r) => ({ id: r.id, mimeType: r.mimeType, sizeBytes: r.sizeBytes, url: (0, exports.signedUrl)(r.id) }));
const ATT = "SELECT id, mime_type AS mimeType, size_bytes AS sizeBytes FROM attachments WHERE complaint_id = ? AND scan_status = 'CLEAN' ORDER BY created_at";
async function listAttachmentsOwn(c, complaintId) { await (0, complaints_1.getOwn)(c, complaintId); return withUrls(await (0, pool_1.query)(ATT, [complaintId])); }
async function listAttachmentsAdmin(c, complaintId) {
    const ok = (await (0, pool_1.query)("SELECT id FROM complaints WHERE id = ? AND organization_id = ?", [complaintId, c.user.organizationId]))[0];
    if (!ok)
        throw (0, errors_1.notFound)();
    return withUrls(await (0, pool_1.query)(ATT, [complaintId]));
}
async function resolveFile(id) {
    const r = (await (0, pool_1.query)("SELECT object_key, mime_type FROM attachments WHERE id = ? AND scan_status = 'CLEAN'", [id]))[0];
    if (!r)
        throw (0, errors_1.notFound)();
    return { file: path_1.default.join(DIR, path_1.default.basename(String(r.object_key))), mime: String(r.mime_type) };
}
