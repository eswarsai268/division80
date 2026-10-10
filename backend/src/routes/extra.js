"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.filesRouter = exports.profileRouter = void 0;
exports.extendAdmin = extendAdmin;
exports.extendBooth = extendBooth;
exports.extendComplaints = extendComplaints;
const express_1 = require("express");
const zod_1 = require("zod");
const authenticate_1 = require("../middleware/authenticate");
const rateLimit_1 = require("../middleware/rateLimit");
const errors_1 = require("../errors");
const http_1 = require("../utils/http");
const a2 = __importStar(require("../services/admin2"));
const ie = __importStar(require("../services/importExport"));
const files = __importStar(require("../services/files"));
const xb = __importStar(require("../services/crossBooth"));
/** Admin routes (auth + ADMIN role + rate limit are already applied by the parent router). */
function extendAdmin(ad) {
    const idp = (req, n) => (0, http_1.parse)(http_1.uuid, req.params[n]);
    ad.get("/citizens", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await a2.listCitizens((0, http_1.ctx)(req), (0, http_1.parse)(http_1.pageQuery.extend({ search: zod_1.z.string().max(100).optional(), boothId: http_1.uuid.optional() }), req.query)))));
    ad.patch("/citizens/:citizenId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await a2.updateCitizen((0, http_1.ctx)(req), idp(req, "citizenId"), (0, http_1.parse)(zod_1.z.object({ fullName: zod_1.z.string().min(1).max(200).optional(), lifeStatus: zod_1.z.enum(["ALIVE", "DECEASED", "UNKNOWN"]).optional() }), req.body)))));
    ad.get("/households", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await a2.listHouseholds((0, http_1.ctx)(req), (0, http_1.parse)(http_1.pageQuery.extend({ search: zod_1.z.string().max(32).optional(), boothId: http_1.uuid.optional(), status: zod_1.z.enum(["PENDING", "IN_VERIFICATION", "RESOLVED"]).optional() }), req.query)))));
    ad.delete("/households/:householdId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await a2.deleteHousehold((0, http_1.ctx)(req), idp(req, "householdId")))));
    ad.get("/assignments", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await a2.listAllAssignments((0, http_1.ctx)(req)))));
    ad.get("/events", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await a2.listEvents((0, http_1.ctx)(req)))));
    ad.patch("/events/:eventId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await a2.updateEvent((0, http_1.ctx)(req), idp(req, "eventId"), (0, http_1.parse)(zod_1.z.object({ title: zod_1.z.string().min(2).max(200).optional(), body: zod_1.z.string().min(2).max(5000).optional(), startsAt: zod_1.z.string().datetime().optional() }), req.body)))));
    ad.get("/complaints/:complaintId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await a2.getComplaintAdmin((0, http_1.ctx)(req), idp(req, "complaintId")))));
    ad.get("/complaints/:complaintId/attachments", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await files.listAttachmentsAdmin((0, http_1.ctx)(req), idp(req, "complaintId")))));
    ad.get("/settings", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await a2.settings((0, http_1.ctx)(req)))));
    ad.patch("/settings/login-media", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await a2.updateLoginVideo((0, http_1.ctx)(req), (0, http_1.parse)(zod_1.z.object({ loginVideoUrl: zod_1.z.string().url().max(1000).nullable() }), req.body).loginVideoUrl))));
    ad.get("/cross-booth", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await xb.listAdminRequests((0, http_1.ctx)(req)))));
    ad.post("/import-jobs", rateLimit_1.limits.importJobs, (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await ie.createImportJob((0, http_1.ctx)(req), (0, http_1.parse)(zod_1.z.object({ csv: zod_1.z.string().min(10).max(8_000_000) }), req.body).csv), 201)));
    ad.get("/import-jobs", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await ie.listImportJobs((0, http_1.ctx)(req)))));
    ad.get("/import-jobs/:jobId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await ie.getImportJob((0, http_1.ctx)(req), idp(req, "jobId")))));
    ad.post("/import-jobs/:jobId/confirm", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await ie.confirmImport((0, http_1.ctx)(req), idp(req, "jobId")))));
    ad.post("/export-jobs", rateLimit_1.limits.exportJobs, (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await ie.createExport((0, http_1.ctx)(req), (0, http_1.parse)(zod_1.z.object({ kind: zod_1.z.enum(["CITIZENS", "HOUSEHOLDS", "COMPLAINTS"]), boothId: http_1.uuid.optional() }), req.body)), 201)));
    ad.get("/export-jobs", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await ie.listExports((0, http_1.ctx)(req)))));
    ad.get("/export-jobs/:jobId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await ie.getExport((0, http_1.ctx)(req), idp(req, "jobId")))));
    ad.get("/export-jobs/:jobId/download", (0, http_1.h)(async (req, res) => {
        const f = await ie.downloadExport((0, http_1.ctx)(req), idp(req, "jobId"));
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="export-${f.kind}-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.send(f.content);
    }));
}
function extendBooth(b) {
    b.get("/verifications", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await a2.listVerificationsForBooths((0, http_1.ctx)(req)))));
}
/** Citizen (USER) complaint attachments. Raw image body is parsed in app.ts (JPEG/PNG only, 5 MB). */
function extendComplaints(cp) {
    cp.post("/:complaintId/attachments", rateLimit_1.limits.upload, (0, http_1.h)(async (req, res) => {
        const mime = String(req.headers["content-type"] ?? "").split(";")[0].trim();
        (0, http_1.ok)(req, res, await files.saveAttachment((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.complaintId), mime, req.body), 201);
    }));
    cp.get("/:complaintId/attachments", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await files.listAttachmentsOwn((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.complaintId)))));
}
exports.profileRouter = (0, express_1.Router)();
exports.profileRouter.use(authenticate_1.authenticate);
exports.profileRouter.get("/", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await a2.getProfile((0, http_1.ctx)(req).user.id))));
exports.profileRouter.patch("/", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await a2.updateProfile((0, http_1.ctx)(req).user.id, (0, http_1.parse)(zod_1.z.object({ fullName: zod_1.z.string().min(2).max(200).optional(), phone: zod_1.z.string().max(32).nullable().optional() }), req.body)))));
/** Short-lived HMAC-signed URLs: the signature IS the authorisation (issued only after an ownership/org check). */
exports.filesRouter = (0, express_1.Router)();
exports.filesRouter.get("/:attachmentId", rateLimit_1.limits.search, (0, http_1.h)(async (req, res) => {
    const id = (0, http_1.parse)(http_1.uuid, req.params.attachmentId);
    const q = (0, http_1.parse)(zod_1.z.object({ exp: zod_1.z.coerce.number().int(), sig: zod_1.z.string().min(20).max(100) }), req.query);
    if (!files.verifySignature(id, q.exp, q.sig))
        throw new errors_1.AppError(403, "FORBIDDEN", "Link is invalid or expired");
    const f = await files.resolveFile(id);
    res.setHeader("Content-Type", f.mime);
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("Cache-Control", "private, max-age=60");
    res.sendFile(f.file, { dotfiles: "deny" });
}));
