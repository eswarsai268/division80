"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.refresh = refresh;
exports.logoutByTokens = logoutByTokens;
exports.me = me;
const crypto_1 = require("crypto");
const env_1 = require("../config/env");
const pool_1 = require("../db/pool");
const errors_1 = require("../errors");
const password_1 = require("../auth/password");
const tokens_1 = require("../auth/tokens");
const audit_1 = require("./audit");
async function createSession(userId, conn) {
    const sessionId = (0, crypto_1.randomUUID)();
    const refreshToken = (0, tokens_1.newRefreshToken)();
    await (0, pool_1.exec)(`INSERT INTO sessions (id, user_id, refresh_hash, expires_at)
     VALUES (?,?,?, DATE_ADD(NOW(3), INTERVAL ${env_1.env.REFRESH_TOKEN_TTL_DAYS} DAY))`, [sessionId, userId, (0, tokens_1.sha256)(refreshToken)], conn);
    return { accessToken: (0, tokens_1.signAccess)(userId, sessionId), refreshToken, sessionId };
}
/** Self-registration ALWAYS creates role USER. Role is never read from the client. */
async function register(i, requestId) {
    const org = (await (0, pool_1.query)("SELECT id FROM organizations WHERE slug = ?", [env_1.env.DEFAULT_ORG_SLUG]))[0];
    if (!org)
        throw new errors_1.AppError(503, "NOT_CONFIGURED", "Service not configured");
    const id = (0, crypto_1.randomUUID)();
    try {
        await (0, pool_1.exec)("INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role) VALUES (?,?,?,?,?,?, 'USER')", [id, org.id, i.email.toLowerCase(), await (0, password_1.hashPassword)(i.password), i.fullName, i.phone ?? null]);
    }
    catch (e) {
        if (e?.code === "ER_DUP_ENTRY")
            throw new errors_1.AppError(409, "REGISTRATION_FAILED", "Unable to register with these details");
        throw e;
    }
    await (0, audit_1.auditSafe)({ actorId: id, action: "REGISTER", resourceType: "USER", resourceId: id, outcome: "SUCCESS", requestId });
    return { id };
}
async function login(email, password, requestId) {
    const u = (await (0, pool_1.query)("SELECT id, password_hash, status FROM users WHERE email = ?", [email.toLowerCase()]))[0];
    const valid = await (0, password_1.verifyPassword)(u?.password_hash ?? (await (0, password_1.dummyHash)()), password);
    if (!u || !valid || u.status !== "ACTIVE") {
        await (0, audit_1.auditSafe)({ actorId: u?.id ?? null, action: "LOGIN", resourceType: "USER", outcome: "FAILURE", requestId });
        throw new errors_1.AppError(401, "INVALID_CREDENTIALS", "Invalid email or password"); // generic
    }
    const t = await createSession(u.id);
    await (0, audit_1.auditSafe)({ actorId: u.id, action: "LOGIN", resourceType: "USER", resourceId: u.id, outcome: "SUCCESS", requestId });
    return t;
}
/** Refresh-token rotation with reuse detection: replaying an old token revokes the whole session. */
async function refresh(presented) {
    const hash = (0, tokens_1.sha256)(presented);
    const out = await (0, pool_1.tx)(async (conn) => {
        const s = (await (0, pool_1.query)(`SELECT s.id, s.user_id, s.refresh_hash, s.revoked_at, (s.expires_at <= NOW(3)) AS expired, u.status
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.refresh_hash = ? OR s.prev_refresh_hash = ? FOR UPDATE`, [hash, hash], conn))[0];
        if (!s || s.revoked_at || s.expired || s.status !== "ACTIVE")
            return null;
        if (s.refresh_hash !== hash) { // reuse of a rotated token => theft suspected
            await (0, pool_1.exec)("UPDATE sessions SET revoked_at = NOW(3) WHERE id = ?", [s.id], conn);
            return null;
        }
        const next = (0, tokens_1.newRefreshToken)();
        await (0, pool_1.exec)("UPDATE sessions SET prev_refresh_hash = refresh_hash, refresh_hash = ? WHERE id = ?", [(0, tokens_1.sha256)(next), s.id], conn);
        return { accessToken: (0, tokens_1.signAccess)(s.user_id, s.id), refreshToken: next, sessionId: s.id };
    });
    if (!out)
        throw (0, errors_1.unauthorized)();
    return out;
}
/** Revokes the session identified by the refresh cookie and/or a still-valid access token. Returns the user id if found. */
async function logoutByTokens(access, refresh) {
    let userId = null;
    if (refresh) {
        const h = (0, tokens_1.sha256)(refresh);
        const s = (await (0, pool_1.query)("SELECT id, user_id FROM sessions WHERE refresh_hash = ? OR prev_refresh_hash = ?", [h, h]))[0];
        if (s) {
            await (0, pool_1.exec)("UPDATE sessions SET revoked_at = NOW(3) WHERE id = ? AND revoked_at IS NULL", [s.id]);
            userId = s.user_id;
        }
    }
    const c = access ? (0, tokens_1.verifyAccess)(access) : null;
    if (c) {
        await (0, pool_1.exec)("UPDATE sessions SET revoked_at = NOW(3) WHERE id = ? AND user_id = ? AND revoked_at IS NULL", [c.sid, c.sub]);
        userId ??= c.sub;
    }
    return userId;
}
async function me(userId) {
    const u = (await (0, pool_1.query)("SELECT id, email, full_name AS fullName, role FROM users WHERE id = ?", [userId]))[0];
    if (!u)
        throw (0, errors_1.unauthorized)();
    return u;
}
