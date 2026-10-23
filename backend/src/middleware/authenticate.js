"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const pool_1 = require("../db/pool");
const errors_1 = require("../errors");
const tokens_1 = require("../auth/tokens");
/** Builds AuthUser from trusted DB state on EVERY request (so revocation is immediate). */
async function authenticate(req, _res, next) {
    try {
        const token = req.cookies?.access_token;
        const claims = typeof token === "string" ? (0, tokens_1.verifyAccess)(token) : null;
        if (!claims)
            throw (0, errors_1.unauthorized)();
        const rows = await (0, pool_1.query)(`SELECT u.id, u.role, u.organization_id
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND s.user_id = ? AND s.revoked_at IS NULL
          AND s.expires_at > NOW(3) AND u.status = 'ACTIVE' AND u.role IN ('ADMIN','BOOTH_MEMBER')`, [claims.sid, claims.sub]);
        const u = rows[0];
        if (!u)
            throw (0, errors_1.unauthorized)();
        const a = await (0, pool_1.query)(`SELECT ba.booth_id
         FROM booth_assignments ba JOIN booths b ON b.id = ba.booth_id
        WHERE ba.user_id = ? AND ba.revoked_at IS NULL AND ba.starts_at <= NOW(3)
          AND (ba.ends_at IS NULL OR ba.ends_at > NOW(3)) AND b.status = 'ACTIVE'`, [u.id]);
        req.user = {
            id: u.id, role: u.role, organizationId: u.organization_id, sessionId: claims.sid,
            boothIds: u.role === "BOOTH_MEMBER" ? a.map((x) => x.booth_id) : [],
        };
        next();
    }
    catch (e) {
        next(e);
    }
}
