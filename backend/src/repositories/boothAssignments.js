"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockActiveBoothAssignment = lockActiveBoothAssignment;
const pool_1 = require("../db/pool");

/** Lock user -> assignment -> booth so account changes and revocation serialize consistently. */
async function lockActiveBoothAssignment(conn, userId, organizationId, boothId) {
    const user = (await (0, pool_1.query)(`SELECT id FROM users
        WHERE id = ? AND organization_id = ? AND role = 'BOOTH_MEMBER' AND status = 'ACTIVE'
        FOR UPDATE`, [userId, organizationId], conn))[0];
    if (!user)
        return false;
    const assignment = (await (0, pool_1.query)(`SELECT id FROM booth_assignments
        WHERE user_id = ? AND booth_id = ? AND revoked_at IS NULL AND starts_at <= NOW(3)
          AND (ends_at IS NULL OR ends_at > NOW(3))
        FOR UPDATE`, [userId, boothId], conn))[0];
    if (!assignment)
        return false;
    const booth = (await (0, pool_1.query)(`SELECT id FROM booths
        WHERE id = ? AND organization_id = ? AND status = 'ACTIVE' FOR UPDATE`,
    [boothId, organizationId], conn))[0];
    return Boolean(booth);
}
