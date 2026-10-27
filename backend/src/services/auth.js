"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.refresh = refresh;
exports.logoutByTokens = logoutByTokens;
exports.me = me;
exports.changePassword = changePassword;
const crypto_1 = require("crypto");
const env_1 = require("../config/env");
const pool_1 = require("../db/pool");
const errors_1 = require("../errors");
const phone_1 = require("../utils/phone");
const password_1 = require("../auth/password");
const tokens_1 = require("../auth/tokens");
async function createSession(userId, conn) {
    const sessionId = (0, crypto_1.randomUUID)();
    const refreshToken = (0, tokens_1.newRefreshToken)();
    await (0, pool_1.exec)(`INSERT INTO sessions (id, user_id, refresh_hash, expires_at)
     VALUES (?,?,?, DATE_ADD(NOW(3), INTERVAL ${env_1.env.REFRESH_TOKEN_TTL_DAYS} DAY))`, [sessionId, userId, (0, tokens_1.sha256)(refreshToken)], conn);
    return { accessToken: (0, tokens_1.signAccess)(userId, sessionId), refreshToken, sessionId };
}
async function login(identifier, password, method = "email") {
    const isPhone = method === "phone";
    const normalizedPhone = isPhone ? (0, phone_1.normalizePhone)(identifier) : null;
    const u = (await (0, pool_1.query)(isPhone
        ? "SELECT id, password_hash, status FROM users WHERE phone = ? AND role = 'BOOTH_MEMBER'"
        : "SELECT id, password_hash, status FROM users WHERE email = ? AND role IN ('ADMIN','BOOTH_MEMBER')",
    [isPhone ? normalizedPhone : String(identifier).toLowerCase()]))[0];
    const valid = await (0, password_1.verifyPassword)(u?.password_hash ?? (await (0, password_1.dummyHash)()), password);
    if (!u || !valid || u.status !== "ACTIVE") {
        throw new errors_1.AppError(401, "INVALID_CREDENTIALS", "Invalid identifier or password");
    }
    return createSession(u.id);
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
    const u = (await (0, pool_1.query)("SELECT id, email, phone, full_name AS fullName, role FROM users WHERE id = ?", [userId]))[0];
    if (!u)
        throw (0, errors_1.unauthorized)();
    return u;
}
async function changePassword(c, input) {
    return (0, pool_1.tx)(async (conn) => {
        const user = (await (0, pool_1.query)("SELECT password_hash FROM users WHERE id = ? AND organization_id = ? AND role = 'ADMIN' AND status = 'ACTIVE' FOR UPDATE", [c.user.id, c.user.organizationId], conn))[0];
        if (!user)
            throw (0, errors_1.unauthorized)();
        if (!(await (0, password_1.verifyPassword)(user.password_hash, input.currentPassword)))
            throw new errors_1.AppError(403, "INVALID_CURRENT_PASSWORD", "Current password is incorrect");
        if (await (0, password_1.verifyPassword)(user.password_hash, input.newPassword))
            throw new errors_1.AppError(422, "PASSWORD_UNCHANGED", "Choose a new password different from your current password");
        const passwordHash = await (0, password_1.hashPassword)(input.newPassword);
        await (0, pool_1.exec)("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, c.user.id], conn);
        await (0, pool_1.exec)("UPDATE sessions SET revoked_at = NOW(3) WHERE user_id = ? AND id <> ? AND revoked_at IS NULL", [c.user.id, c.user.sessionId], conn);
        return { changed: true, otherSessionsRevoked: true };
    });
}
