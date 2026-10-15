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
const express_1 = require("express");
const zod_1 = require("zod");
const env_1 = require("../config/env");
const redis_1 = require("../cache/redis");
const pool_1 = require("../db/pool");
const authenticate_1 = require("../middleware/authenticate");
const authorize_1 = require("../middleware/authorize");
const rateLimit_1 = require("../middleware/rateLimit");
const boothScope_1 = require("../middleware/boothScope");
const http_1 = require("../utils/http");
const auth = __importStar(require("../services/auth"));
const admin = __importStar(require("../services/admin"));
const complaints = __importStar(require("../services/complaints"));
const verification = __importStar(require("../services/verification"));
const xb = __importStar(require("../services/crossBooth"));
const households_1 = require("../repositories/households");
const audit_1 = require("../services/audit");
const extra_1 = require("./extra");
const router = (0, express_1.Router)();
const password = zod_1.z.string().min(12).max(128);
const registrationPassword = zod_1.z.string().min(8, "Password must contain at least 8 characters").max(128);
const boothMemberCredentials = zod_1.z.object({
    email: zod_1.z.string().email().max(255),
    fullName: zod_1.z.string().min(2).max(200),
    password,
    canApproveCrossBooth: zod_1.z.boolean().default(false),
});
const ACCESS_MS = env_1.env.ACCESS_TOKEN_TTL_SECONDS * 1000;
const REFRESH_MS = env_1.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000;
function setCookies(res, t) {
    const base = { httpOnly: true, secure: env_1.env.NODE_ENV === "production", sameSite: "strict" };
    res.cookie("access_token", t.accessToken, { ...base, path: "/", maxAge: ACCESS_MS });
    res.cookie("refresh_token", t.refreshToken, { ...base, path: "/api/v1/auth", maxAge: REFRESH_MS });
}
const clearCookies = (res) => { res.clearCookie("access_token", { path: "/" }); res.clearCookie("refresh_token", { path: "/api/v1/auth" }); };
/* ------------------------------ AUTH ------------------------------ */
const a = (0, express_1.Router)();
a.post("/register", rateLimit_1.limits.register, (0, http_1.h)(async (req, res) => {
    // Unknown keys (e.g. "role") are stripped by zod and ignored: self-registration is always USER.
    const body = (0, http_1.parse)(zod_1.z.object({ email: zod_1.z.string().email().max(255), password: registrationPassword, fullName: zod_1.z.string().min(2).max(200), phone: zod_1.z.string().max(32).optional() }), req.body);
    (0, http_1.ok)(req, res, await auth.register(body, String(req.id)), 201);
}));
a.post("/login", rateLimit_1.limits.login, rateLimit_1.limits.loginEmail, (0, http_1.h)(async (req, res) => {
    const body = (0, http_1.parse)(zod_1.z.object({ email: zod_1.z.string().email().max(255), password: zod_1.z.string().min(1).max(128) }), req.body);
    setCookies(res, await auth.login(body.email, body.password, String(req.id)));
    (0, http_1.ok)(req, res, { loggedIn: true });
}));
a.post("/refresh", rateLimit_1.limits.refresh, (0, http_1.h)(async (req, res) => {
    const t = req.cookies?.refresh_token;
    if (typeof t !== "string") {
        clearCookies(res);
        return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" }, requestId: String(req.id) });
    }
    try {
        setCookies(res, await auth.refresh(t));
        (0, http_1.ok)(req, res, { refreshed: true });
    }
    catch (e) {
        clearCookies(res);
        throw e;
    }
}));
a.post("/logout", (0, http_1.h)(async (req, res) => {
    const uid = await auth.logoutByTokens(req.cookies?.access_token, req.cookies?.refresh_token);
    if (uid)
        await (0, audit_1.auditSafe)({ actorId: uid, action: "LOGOUT", resourceType: "USER", resourceId: uid, outcome: "SUCCESS", requestId: String(req.id) });
    clearCookies(res);
    (0, http_1.ok)(req, res, { loggedOut: true });
}));
a.get("/me", authenticate_1.authenticate, (0, http_1.h)(async (req, res) => {
    const c = (0, http_1.ctx)(req);
    (0, http_1.ok)(req, res, { ...(await auth.me(c.user.id)), boothIds: c.user.boothIds, approverBoothIds: c.user.approverBoothIds });
}));
a.get("/login-media", (0, http_1.h)(async (req, res) => {
    const row = (await (0, pool_1.query)(`SELECT s.login_video_url AS loginVideoUrl FROM organizations o
      LEFT JOIN organization_settings s ON s.organization_id = o.id WHERE o.slug = ?`, [env_1.env.DEFAULT_ORG_SLUG]))[0];
    (0, http_1.ok)(req, res, { loginVideoUrl: row?.loginVideoUrl ?? null });
}));
router.use("/auth", a);
/* ------------------------------ PUBLIC ------------------------------ */
const pub = (0, express_1.Router)();
async function publicContent(kind) {
    const key = `public:${env_1.env.DEFAULT_ORG_SLUG}:${kind}`; // public data only — safe to cache
    const hit = redis_1.redis?.isOpen ? await redis_1.redis.get(key).catch(() => null) : null;
    if (hit)
        return JSON.parse(hit);
    const rows = await (0, pool_1.query)(`SELECT e.id, e.title, e.body, e.starts_at AS startsAt, e.published_at AS publishedAt FROM events e
       JOIN organizations o ON o.id = e.organization_id
      WHERE o.slug = ? AND e.kind = ? AND e.status = 'PUBLISHED' ORDER BY COALESCE(e.starts_at, e.published_at) DESC LIMIT 50`, [env_1.env.DEFAULT_ORG_SLUG, kind]);
    if (redis_1.redis?.isOpen)
        await redis_1.redis.set(key, JSON.stringify(rows), { EX: 60 }).catch(() => undefined);
    return rows;
}
pub.get("/events", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await publicContent("EVENT"))));
pub.get("/announcements", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await publicContent("ANNOUNCEMENT"))));
router.use("/public", pub);
/* ------------------------------ CITIZEN COMPLAINTS ------------------------------ */
const cp = (0, express_1.Router)();
cp.use(authenticate_1.authenticate, (0, authorize_1.authorize)("USER"));
cp.post("/", rateLimit_1.limits.complaint, (0, http_1.h)(async (req, res) => {
    const body = (0, http_1.parse)(zod_1.z.object({ title: zod_1.z.string().min(3).max(200), description: zod_1.z.string().min(10).max(5000),
        category: zod_1.z.string().min(2).max(64), location: zod_1.z.string().max(255).optional() }), req.body);
    (0, http_1.ok)(req, res, await complaints.createComplaint((0, http_1.ctx)(req), body), 201);
}));
cp.get("/mine", (0, http_1.h)(async (req, res) => { const q = (0, http_1.parse)(http_1.pageQuery, req.query); (0, http_1.ok)(req, res, await complaints.listMine((0, http_1.ctx)(req), q.limit, q.cursor)); }));
cp.get("/:complaintId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await complaints.getOwn((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.complaintId)))));
cp.get("/:complaintId/timeline", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await complaints.timelineOwn((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.complaintId)))));
(0, extra_1.extendComplaints)(cp);
router.use("/complaints", cp);
router.use("/profile", extra_1.profileRouter);
router.use("/files", extra_1.filesRouter);
/* ------------------------------ BOOTH MEMBER ------------------------------ */
const b = (0, express_1.Router)();
b.use(authenticate_1.authenticate, (0, authorize_1.authorize)("BOOTH_MEMBER"));
b.get("/dashboard", (0, http_1.h)(async (req, res) => {
    const { user } = (0, http_1.ctx)(req);
    if (!user.boothIds.length)
        return (0, http_1.ok)(req, res, { booths: 0, households: { PENDING: 0, IN_VERIFICATION: 0, RESOLVED: 0 }, complaints: {} });
    const ph = user.boothIds.map(() => "?").join(",");
    const hs = await (0, pool_1.query)(`SELECT verification_status s, COUNT(*) n FROM households WHERE booth_id IN (${ph}) AND deleted_at IS NULL GROUP BY verification_status`, user.boothIds);
    const cs = await (0, pool_1.query)(`SELECT status s, COUNT(*) n FROM complaints WHERE assigned_booth_id IN (${ph}) GROUP BY status`, user.boothIds);
    const households = { PENDING: 0, IN_VERIFICATION: 0, RESOLVED: 0 };
    hs.forEach((r) => { households[r.s] = Number(r.n); });
    (0, http_1.ok)(req, res, { booths: user.boothIds.length, households, complaints: Object.fromEntries(cs.map((r) => [r.s, Number(r.n)])) });
}));
b.get("/households", rateLimit_1.limits.search, (0, http_1.h)(async (req, res) => {
    const q = (0, http_1.parse)(http_1.pageQuery.extend({ limit: zod_1.z.coerce.number().int().min(1).max(1000).default(1000), search: zod_1.z.string().max(100).optional(), status: zod_1.z.enum(["PENDING", "IN_VERIFICATION", "RESOLVED", "UNVERIFIED"]).optional(), boothId: http_1.uuid.optional() }), req.query);
    (0, http_1.ok)(req, res, await (0, households_1.listHouseholdsForUser)((0, http_1.ctx)(req).user, q)); // boothId is only a filter; scope still comes from assignments
}));
b.get("/households/:householdId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await (0, households_1.getHouseholdForUser)((0, http_1.ctx)(req).user, (0, http_1.parse)(http_1.uuid, req.params.householdId)))));
b.get("/households/:householdId/citizens", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await (0, households_1.listCitizensForUser)((0, http_1.ctx)(req).user, (0, http_1.parse)(http_1.uuid, req.params.householdId)))));
b.get("/booths/:boothId/summary", (0, boothScope_1.requireBoothAccess)("boothId"), (0, http_1.h)(async (req, res) => {
    const n = (await (0, pool_1.query)("SELECT COUNT(*) n FROM households WHERE booth_id = ? AND deleted_at IS NULL", [req.params.boothId]))[0].n;
    (0, http_1.ok)(req, res, { boothId: req.params.boothId, households: Number(n) });
}));
b.get("/complaints", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await complaints.listForBooth((0, http_1.ctx)(req), (0, http_1.parse)(zod_1.z.object({ status: zod_1.z.string().max(32).optional() }), req.query).status))));
b.get("/complaints/:complaintId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await complaints.getForBooth((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.complaintId)))));
b.post("/verifications", rateLimit_1.limits.verification, (0, http_1.h)(async (req, res) => {
    const body = (0, http_1.parse)(zod_1.z.object({ citizenId: http_1.uuid, step: zod_1.z.number().int().min(1).max(6), result: zod_1.z.enum(["PASSED", "FAILED"]), notes: zod_1.z.string().max(500).optional() }), req.body);
    const key = (0, http_1.parse)(zod_1.z.string().min(8).max(64).optional(), req.header("idempotency-key"));
    (0, http_1.ok)(req, res, await verification.recordVerification((0, http_1.ctx)(req), body, key), 201);
}));
b.get("/verifications/:verificationId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await verification.getVerificationForUser((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.verificationId)))));
(0, extra_1.extendBooth)(b);
router.use("/booth", b);
/* ------------------------------ CROSS BOOTH ------------------------------ */
const x = (0, express_1.Router)();
x.use(authenticate_1.authenticate, (0, authorize_1.authorize)("BOOTH_MEMBER"), rateLimit_1.limits.crossBooth);
x.post("/requests", (0, http_1.h)(async (req, res) => {
    const body = (0, http_1.parse)(zod_1.z.object({ sourceBoothId: http_1.uuid, householdId: http_1.uuid.optional(),
        voterId: zod_1.z.string().regex(/^[A-Za-z0-9]{6,20}$/).optional(), action: zod_1.z.enum(["READ", "VERIFY"]).default("READ"),
        reason: zod_1.z.string().min(5).max(500) }).refine((v) => Boolean(v.householdId || v.voterId), "Provide a householdId or voterId"), req.body);
    (0, http_1.ok)(req, res, await xb.createRequest((0, http_1.ctx)(req), body), 201);
}));
x.get("/requests", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await xb.listRequests((0, http_1.ctx)(req)))));
x.get("/requests/:requestId/household", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await xb.getGrantedHousehold((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.requestId)))));
x.post("/requests/:requestId/approve", (0, http_1.h)(async (req, res) => {
    const body = (0, http_1.parse)(zod_1.z.object({ grantHours: zod_1.z.number().int().min(1).max(24).default(4) }), req.body ?? {});
    (0, http_1.ok)(req, res, await xb.approveRequest((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.requestId), body.grantHours));
}));
x.post("/requests/:requestId/reject", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await xb.rejectRequest((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.requestId)))));
router.use("/cross-booth", x);
/* ------------------------------ ADMIN ------------------------------ */
const ad = (0, express_1.Router)();
ad.use(authenticate_1.authenticate, (0, authorize_1.authorize)("ADMIN"), rateLimit_1.limits.admin);
ad.get("/dashboard", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.dashboard((0, http_1.ctx)(req)))));
ad.post("/booths", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.createBooth((0, http_1.ctx)(req), (0, http_1.parse)(zod_1.z.object({
    code: zod_1.z.string().min(1).max(32),
    name: zod_1.z.string().min(2).max(200),
    member: boothMemberCredentials.optional(),
}), req.body)), 201)));
ad.get("/booths", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.listBooths((0, http_1.ctx)(req)))));
ad.get("/booths/:boothId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.getBooth((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.boothId)))));
ad.patch("/booths/:boothId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.updateBooth((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.boothId), (0, http_1.parse)(zod_1.z.object({ name: zod_1.z.string().min(2).max(200).optional(), status: zod_1.z.enum(["ACTIVE", "INACTIVE"]).optional() }), req.body)))));
ad.post("/booths/:boothId/assignments", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.assignMember((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.boothId), (0, http_1.parse)(zod_1.z.object({ userId: http_1.uuid, canApproveCrossBooth: zod_1.z.boolean().default(false) }), req.body)), 201)));
ad.get("/booths/:boothId/assignments", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.listAssignments((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.boothId)))));
ad.delete("/assignments/:assignmentId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.revokeAssignment((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.assignmentId)))));
ad.get("/users", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.listUsers((0, http_1.ctx)(req), (0, http_1.parse)(zod_1.z.enum(["ADMIN", "BOOTH_MEMBER", "USER"]).optional(), req.query.role)))));
ad.post("/users", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.createUser((0, http_1.ctx)(req), (0, http_1.parse)(zod_1.z.object({
    email: zod_1.z.string().email().max(255),
    fullName: zod_1.z.string().min(2).max(200),
    password,
    role: zod_1.z.enum(["BOOTH_MEMBER", "USER"]),
    boothId: http_1.uuid.optional(),
    canApproveCrossBooth: zod_1.z.boolean().default(false),
}).superRefine((value, ctx) => {
    if (value.role === "BOOTH_MEMBER" && !value.boothId) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["boothId"], message: "Select a booth for this booth member" });
    }
    if (value.role === "USER" && value.boothId) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["boothId"], message: "Citizens cannot be assigned to a booth" });
    }
}), req.body)), 201)));
ad.patch("/users/:userId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.updateUser((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.userId), (0, http_1.parse)(zod_1.z.object({ status: zod_1.z.enum(["ACTIVE", "SUSPENDED"]).optional(), role: zod_1.z.enum(["BOOTH_MEMBER", "USER"]).optional() }), req.body)))));
ad.get("/complaints", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await complaints.adminList((0, http_1.ctx)(req), (0, http_1.parse)(http_1.pageQuery.extend({ status: zod_1.z.string().max(32).optional() }), req.query)))));
ad.patch("/complaints/:complaintId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await complaints.adminUpdate((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.complaintId), (0, http_1.parse)(zod_1.z.object({ status: zod_1.z.enum(["UNDER_REVIEW", "ASSIGNED", "IN_VERIFICATION", "RESOLVED", "REJECTED", "REOPENED"]).optional(), assignedBoothId: http_1.uuid.optional(), note: zod_1.z.string().max(500).optional(), expectedVersion: zod_1.z.number().int().optional() }), req.body)))));
ad.get("/audit-logs", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.listAudit((0, http_1.ctx)(req), (0, http_1.parse)(http_1.pageQuery, req.query).limit))));
ad.post("/events", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.createEvent((0, http_1.ctx)(req), (0, http_1.parse)(zod_1.z.object({ kind: zod_1.z.enum(["EVENT", "ANNOUNCEMENT"]), title: zod_1.z.string().min(2).max(200), body: zod_1.z.string().min(2).max(5000), startsAt: zod_1.z.string().datetime().optional() }), req.body)), 201)));
ad.post("/events/:eventId/publish", (0, http_1.h)(async (req, res) => { const r = await admin.setEventStatus((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.eventId), "PUBLISHED"); await redis_1.redis?.del([`public:${env_1.env.DEFAULT_ORG_SLUG}:EVENT`, `public:${env_1.env.DEFAULT_ORG_SLUG}:ANNOUNCEMENT`]).catch(() => undefined); (0, http_1.ok)(req, res, r); }));
ad.post("/events/:eventId/archive", (0, http_1.h)(async (req, res) => { const r = await admin.setEventStatus((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.eventId), "ARCHIVED"); await redis_1.redis?.del([`public:${env_1.env.DEFAULT_ORG_SLUG}:EVENT`, `public:${env_1.env.DEFAULT_ORG_SLUG}:ANNOUNCEMENT`]).catch(() => undefined); (0, http_1.ok)(req, res, r); }));
(0, extra_1.extendAdmin)(ad);
router.use("/admin", ad);
exports.default = router;
