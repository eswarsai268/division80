"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskVoter = void 0;
exports.listAssignedBoothsForUser = listAssignedBoothsForUser;
exports.listHouseholdsForUser = listHouseholdsForUser;
exports.getHouseholdForUser = getHouseholdForUser;
exports.listCitizensForUser = listCitizensForUser;
exports.updateVisitForUser = updateVisitForUser;
const pool_1 = require("../db/pool");
const errors_1 = require("../errors");
const audit_1 = require("../services/audit");
const maskVoter = (v) => (v ? `****${v.slice(-4)}` : null);
exports.maskVoter = maskVoter;
const escLike = (s) => s.replace(/[\\%_]/g, (m) => "\\" + m);
async function listAssignedBoothsForUser(u) {
    if (u.role !== "BOOTH_MEMBER")
        throw (0, errors_1.forbidden)();
    if (u.boothIds.length === 0)
        return [];
    return (0, pool_1.query)(`SELECT id, code, name FROM booths
        WHERE id IN (${(0, pool_1.placeholders)(u.boothIds.length)}) AND status = 'ACTIVE'
        ORDER BY code`, u.boothIds);
}
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
        const search = escLike(f.search.trim().toUpperCase()) + "%";
        where.push(`(UPPER(h.house_code) LIKE ? OR EXISTS (
            SELECT 1 FROM citizens c WHERE c.household_id = h.id AND c.deleted_at IS NULL
              AND (UPPER(c.full_name) LIKE ? OR UPPER(COALESCE(c.voter_id, '')) LIKE ?
                   OR UPPER(COALESCE(c.roll_serial, '')) LIKE ?)
        ))`);
        params.push(search, search, search, search);
    }
    if (f.status) {
        if (f.status === "UNVERIFIED") {
            where.push(`EXISTS (SELECT 1 FROM citizens c WHERE c.household_id = h.id
                AND c.deleted_at IS NULL AND c.d2d_verified = 0)`);
        }
        else if (f.status === "RESOLVED") {
            where.push(`EXISTS (SELECT 1 FROM citizens c WHERE c.household_id = h.id AND c.deleted_at IS NULL)
                AND NOT EXISTS (SELECT 1 FROM citizens c WHERE c.household_id = h.id
                    AND c.deleted_at IS NULL AND c.d2d_verified = 0)`);
        }
        else {
            where.push("h.verification_status = ?");
            params.push(f.status);
        }
    }
    if (f.cursor) {
        const cursor = (await (0, pool_1.query)(`SELECT b.code AS boothCode, h.house_code AS houseCode
            FROM households h JOIN booths b ON b.id = h.booth_id
            WHERE h.id = ? AND h.booth_id IN (${(0, pool_1.placeholders)(booths.length)})
              AND h.deleted_at IS NULL`, [f.cursor, ...booths]))[0];
        if (!cursor)
            return { items: [], nextCursor: null };
        where.push(`(b.code > ? OR (b.code = ? AND h.house_code > ?)
            OR (b.code = ? AND h.house_code = ? AND h.id > ?))`);
        params.push(cursor.boothCode, cursor.boothCode, cursor.houseCode,
            cursor.boothCode, cursor.houseCode, f.cursor);
    }
    const rows = await (0, pool_1.query)(`SELECT h.id, h.booth_id AS boothId, b.code AS boothCode, b.name AS boothName,
            h.house_code AS houseCode, h.verification_status AS status,
            (SELECT COUNT(*) FROM citizens c WHERE c.household_id = h.id AND c.deleted_at IS NULL) AS citizenCount,
            (SELECT COUNT(*) FROM citizens c WHERE c.household_id = h.id AND c.deleted_at IS NULL AND c.d2d_verified = 1) AS visitedCount
       FROM households h JOIN booths b ON b.id = h.booth_id
      WHERE ${where.join(" AND ")} ORDER BY b.code, h.house_code, h.id LIMIT ${f.limit + 1}`, params);
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
    const rows = await (0, pool_1.query)(`SELECT h.id, h.booth_id AS boothId, b.code AS boothCode, h.house_code AS houseCode, h.address_line AS address,
            h.verification_status AS status
       FROM households h JOIN booths b ON b.id = h.booth_id
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
            c.roll_serial AS rollSerial, c.age, c.gender, c.d2d_verified AS verificationDone,
            c.not_here AS notHere, c.address_changed AS addressChanged,
            c.new_address AS newAddress, c.visit_notes AS visitNotes,
            (SELECT COUNT(*) FROM verifications v WHERE v.citizen_id = c.id AND v.result = 'PASSED') AS passedSteps
       FROM citizens c WHERE c.household_id = ? AND c.deleted_at IS NULL ORDER BY c.relation, c.full_name`, [householdId]);
    return {
        household: house,
        citizens: rows.map((r) => ({ ...r, voterId: house.ownBooth ? r.voterId : (0, exports.maskVoter)(r.voterId), passedSteps: Number(r.passedSteps) })),
    };
}
async function updateVisitForUser(c, citizenId, input) {
    const u = c.user;
    if (u.role !== "BOOTH_MEMBER" || u.boothIds.length === 0)
        throw (0, errors_1.notFound)();
    const placeholders = (0, pool_1.placeholders)(u.boothIds.length);
    return (0, pool_1.tx)(async (conn) => {
        const citizen = (await (0, pool_1.query)(`SELECT id FROM citizens
            WHERE id = ? AND booth_id IN (${placeholders}) AND deleted_at IS NULL FOR UPDATE`,
        [citizenId, ...u.boothIds], conn))[0];
        if (!citizen)
            throw (0, errors_1.notFound)();
        await (0, pool_1.exec)(`UPDATE citizens SET life_status = ?, d2d_verified = ?, not_here = ?, address_changed = ?,
            new_address = ?, visit_notes = ? WHERE id = ? AND deleted_at IS NULL`,
        [input.lifeStatus, input.verificationDone ? 1 : 0, input.notHere ? 1 : 0, input.addressChanged ? 1 : 0,
            input.addressChanged ? input.newAddress || null : null, input.visitNotes || null, citizenId], conn);
        await (0, audit_1.audit)({
            actorId: u.id,
            action: "CITIZEN_VISIT_UPDATE",
            resourceType: "CITIZEN",
            resourceId: citizenId,
            scope: "assigned booth",
            outcome: "SUCCESS",
            reason: "D2D visit details updated",
            requestId: c.requestId,
        }, conn);
        return { id: citizenId };
    });
}
