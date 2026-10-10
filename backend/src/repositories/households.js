"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskVoter = void 0;
exports.listHouseholdsForUser = listHouseholdsForUser;
exports.getHouseholdForUser = getHouseholdForUser;
exports.listCitizensForUser = listCitizensForUser;
const pool_1 = require("../db/pool");
const errors_1 = require("../errors");
const maskVoter = (v) => (v ? `****${v.slice(-4)}` : null);
exports.maskVoter = maskVoter;
const escLike = (s) => s.replace(/[\\%_]/g, (m) => "\\" + m);
/** Scope is derived ONLY from the authenticated user's active assignments, never from client input. */
async function listHouseholdsForUser(u, f) {
    if (u.role !== "BOOTH_MEMBER")
        throw (0, errors_1.forbidden)();
    let booths = u.boothIds;
    if (f.boothId) {
        if (!booths.includes(f.boothId))
            throw (0, errors_1.forbidden)();
        booths = [f.boothId];
    }
    if (booths.length === 0)
        return { items: [], nextCursor: null };
    const where = [`h.booth_id IN (${(0, pool_1.placeholders)(booths.length)})`, "h.deleted_at IS NULL"];
    const params = [...booths];
    if (f.search) {
        where.push("h.house_code LIKE ?");
        params.push(escLike(f.search.toUpperCase()) + "%");
    }
    if (f.status) {
        where.push("h.verification_status = ?");
        params.push(f.status);
    }
    if (f.cursor) {
        where.push("h.id > ?");
        params.push(f.cursor);
    }
    const rows = await (0, pool_1.query)(`SELECT h.id, h.booth_id AS boothId, h.house_code AS houseCode, h.verification_status AS status
       FROM households h WHERE ${where.join(" AND ")} ORDER BY h.id LIMIT ${f.limit + 1}`, params);
    const more = rows.length > f.limit;
    const items = more ? rows.slice(0, f.limit) : rows;
    return { items, nextCursor: more ? items[items.length - 1].id : null };
}
/**
 * Access = household is in one of the caller's ACTIVE booths, OR the caller holds an
 * unexpired, approved, single-resource cross-booth READ grant issued to them from a booth
 * they are still actively assigned to. Unauthorised == 404 (no existence oracle).
 */
async function getHouseholdForUser(u, householdId) {
    if (u.role !== "BOOTH_MEMBER" || u.boothIds.length === 0)
        throw (0, errors_1.notFound)();
    const n = u.boothIds.length;
    const rows = await (0, pool_1.query)(`SELECT h.id, h.booth_id AS boothId, h.house_code AS houseCode, h.address_line AS address,
            h.verification_status AS status
       FROM households h
      WHERE h.id = ? AND h.deleted_at IS NULL
        AND ( h.booth_id IN (${(0, pool_1.placeholders)(n)})
              OR EXISTS (SELECT 1 FROM cross_booth_requests r
                          WHERE r.requester_id = ? AND r.resource_type = 'HOUSEHOLD'
                            AND r.resource_id = h.id AND r.action = 'READ'
                            AND r.status = 'APPROVED' AND r.grant_expires_at > NOW(3)
                            AND r.source_booth_id IN (${(0, pool_1.placeholders)(n)})) )`, [householdId, ...u.boothIds, u.id, ...u.boothIds]);
    if (!rows[0])
        throw (0, errors_1.notFound)();
    return { ...rows[0], ownBooth: u.boothIds.includes(rows[0].boothId) };
}
async function listCitizensForUser(u, householdId) {
    const house = await getHouseholdForUser(u, householdId); // authorisation first
    const rows = await (0, pool_1.query)(`SELECT c.id, c.full_name AS fullName, c.relation, c.voter_id AS voterId, c.life_status AS lifeStatus,
            (SELECT COUNT(*) FROM verifications v WHERE v.citizen_id = c.id AND v.result = 'PASSED') AS passedSteps
       FROM citizens c WHERE c.household_id = ? ORDER BY c.relation, c.full_name`, [householdId]);
    return {
        household: house,
        citizens: rows.map((r) => ({ ...r, voterId: (0, exports.maskVoter)(r.voterId), passedSteps: Number(r.passedSteps) })),
    };
}
