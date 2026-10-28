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
const authenticate_1 = require("../middleware/authenticate");
const authorize_1 = require("../middleware/authorize");
const rateLimit_1 = require("../middleware/rateLimit");
const boothScope_1 = require("../middleware/boothScope");
const http_1 = require("../utils/http");
const auth = __importStar(require("../services/auth"));
const admin = __importStar(require("../services/admin"));
const booth = __importStar(require("../services/booth"));
const publicContent = __importStar(require("../services/publicContent"));
const verification = __importStar(require("../services/verification"));
const households_1 = require("../repositories/households");
const extra_1 = require("./extra");
const router = (0, express_1.Router)();
const password = zod_1.z.string().min(4).max(128);
const phone = zod_1.z.string().min(8).max(24).regex(/^\+?[0-9 ()-]+$/).refine((value) => /^\+?[1-9]\d{7,14}$/.test(value.replace(/[()\s-]/g, "")), "Enter a valid phone number");
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
a.post("/login", rateLimit_1.limits.login, rateLimit_1.limits.loginEmail, (0, http_1.h)(async (req, res) => {
    const body = (0, http_1.parse)(zod_1.z.object({
        email: zod_1.z.string().email().max(255).optional(),
        phone: phone.optional(),
        password: zod_1.z.string().min(1).max(128),
    }).refine((value) => Boolean(value.email) !== Boolean(value.phone), "Provide either email or phone"), req.body);
    setCookies(res, await auth.login(body.phone ?? body.email, body.password, body.phone ? "phone" : "email", String(req.id)));
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
    await auth.logoutByTokens(req.cookies?.access_token, req.cookies?.refresh_token);
    clearCookies(res);
    (0, http_1.ok)(req, res, { loggedOut: true });
}));
a.get("/me", authenticate_1.authenticate, (0, http_1.h)(async (req, res) => {
    const c = (0, http_1.ctx)(req);
    (0, http_1.ok)(req, res, { ...(await auth.me(c.user.id)), organizationId: c.user.organizationId, boothIds: c.user.boothIds });
}));
a.get("/login-media", (0, http_1.h)(async (req, res) => {
    (0, http_1.ok)(req, res, await publicContent.getLoginMedia());
}));
router.use("/auth", a);
/* ------------------------------ PUBLIC ------------------------------ */
const pub = (0, express_1.Router)();
pub.get("/events", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await publicContent.getPublicContent("EVENT"))));
pub.get("/announcements", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await publicContent.getPublicContent("ANNOUNCEMENT"))));
router.use("/public", pub);
/* ------------------------------ BOOTH MEMBER ------------------------------ */
const b = (0, express_1.Router)();
b.use(authenticate_1.authenticate, (0, authorize_1.authorize)("BOOTH_MEMBER"));
b.get("/dashboard", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await booth.dashboard((0, http_1.ctx)(req).user))));
b.get("/households", rateLimit_1.limits.search, (0, http_1.h)(async (req, res) => {
    const q = (0, http_1.parse)(http_1.pageQuery.extend({ limit: zod_1.z.coerce.number().int().min(1).max(1000).default(1000), search: zod_1.z.string().max(100).optional(), status: zod_1.z.enum(["PENDING", "IN_VERIFICATION", "RESOLVED", "UNVERIFIED"]).optional(), boothId: http_1.uuid.optional() }), req.query);
    (0, http_1.ok)(req, res, await (0, households_1.listHouseholdsForUser)((0, http_1.ctx)(req).user, q)); // boothId is only a filter; the repository enforces organization scope
}));
b.get("/households/:householdId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await (0, households_1.getHouseholdForUser)((0, http_1.ctx)(req).user, (0, http_1.parse)(http_1.uuid, req.params.householdId)))));
b.get("/households/:householdId/citizens", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await (0, households_1.listCitizensForUser)((0, http_1.ctx)(req).user, (0, http_1.parse)(http_1.uuid, req.params.householdId)))));
b.get("/booths/:boothId/summary", (0, boothScope_1.requireBoothAccess)("boothId"), (0, http_1.h)(async (req, res) => {
    (0, http_1.ok)(req, res, await booth.householdSummary(req.params.boothId));
}));
b.post("/verifications", rateLimit_1.limits.verification, (0, http_1.h)(async (req, res) => {
    const body = (0, http_1.parse)(zod_1.z.object({ citizenId: http_1.uuid, step: zod_1.z.number().int().min(1).max(6), result: zod_1.z.enum(["PASSED", "FAILED"]), notes: zod_1.z.string().max(500).optional() }), req.body);
    const key = (0, http_1.parse)(zod_1.z.string().min(8).max(64).optional(), req.header("idempotency-key"));
    (0, http_1.ok)(req, res, await verification.recordVerification((0, http_1.ctx)(req), body, key), 201);
}));
b.get("/verifications/:verificationId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await verification.getVerificationForUser((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.verificationId)))));
(0, extra_1.extendBooth)(b);
router.use("/booth", b);
/* ------------------------------ ADMIN ------------------------------ */
const ad = (0, express_1.Router)();
ad.use(authenticate_1.authenticate, (0, authorize_1.authorize)("ADMIN"), rateLimit_1.limits.admin);
ad.get("/dashboard", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.dashboard((0, http_1.ctx)(req)))));
ad.post("/booths", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.createBooth((0, http_1.ctx)(req), (0, http_1.parse)(zod_1.z.object({
    code: zod_1.z.string().min(1).max(255).refine((value) => !/[\u0000-\u001F\u007F]/.test(value)),
    name: zod_1.z.string().min(2).max(200),
    member: zod_1.z.object({ phone, fullName: zod_1.z.string().min(2).max(200), password }).optional(),
}), req.body)), 201)));
ad.get("/booths", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.listBooths((0, http_1.ctx)(req)))));
ad.get("/booths/:boothId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.getBooth((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.boothId)))));
ad.patch("/booths/:boothId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.updateBooth((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.boothId), (0, http_1.parse)(zod_1.z.object({ name: zod_1.z.string().min(2).max(200).optional(), status: zod_1.z.enum(["ACTIVE", "INACTIVE"]).optional() }), req.body)))));
ad.post("/booths/:boothId/assignments", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.assignMember((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.boothId), (0, http_1.parse)(zod_1.z.object({ userId: http_1.uuid }), req.body)), 201)));
ad.get("/booths/:boothId/assignments", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.listAssignments((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.boothId)))));
ad.delete("/assignments/:assignmentId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.revokeAssignment((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.assignmentId)))));
ad.get("/users", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.listUsers((0, http_1.ctx)(req), (0, http_1.parse)(zod_1.z.enum(["ADMIN", "BOOTH_MEMBER"]).optional(), req.query.role)))));
ad.post("/users", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.createUser((0, http_1.ctx)(req), (0, http_1.parse)(zod_1.z.object({
    phone,
    fullName: zod_1.z.string().min(2).max(200),
    password,
    role: zod_1.z.literal("BOOTH_MEMBER"),
}), req.body)), 201)));
ad.patch("/users/:userId", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.updateUser((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.userId), (0, http_1.parse)(zod_1.z.object({ status: zod_1.z.enum(["ACTIVE", "SUSPENDED"]).optional() }), req.body)))));
ad.post("/events", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.createEvent((0, http_1.ctx)(req), (0, http_1.parse)(zod_1.z.object({ kind: zod_1.z.enum(["EVENT", "ANNOUNCEMENT"]), title: zod_1.z.string().min(2).max(200), body: zod_1.z.string().min(2).max(5000), startsAt: zod_1.z.string().datetime().optional() }), req.body)), 201)));
ad.post("/events/:eventId/publish", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.setEventStatus((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.eventId), "PUBLISHED"))));
ad.post("/events/:eventId/archive", (0, http_1.h)(async (req, res) => (0, http_1.ok)(req, res, await admin.setEventStatus((0, http_1.ctx)(req), (0, http_1.parse)(http_1.uuid, req.params.eventId), "ARCHIVED"))));
(0, extra_1.extendAdmin)(ad);
router.use("/admin", ad);
exports.default = router;
