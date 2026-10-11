"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectRequest = exports.approveRequest = void 0;
exports.createRequest = createRequest;
exports.listRequests = listRequests;
exports.getGrantedHousehold = getGrantedHousehold;
exports.listAdminRequests = listAdminRequests;
const crypto_1 = require("crypto");
const pool_1 = require("../db/pool");
const errors_1 = require("../errors");
const households_1 = require("../repositories/households");
const audit_1 = require("./audit");
const REQUEST_VALID_HOURS = 24;
async function createRequest(c, i) {
    const u = c.user;
    if (u.role !== "BOOTH_MEMBER" || !u.boothIds.includes(i.sourceBoothId))
        throw (0, errors_1.forbidden)();
    return (0, pool_1.tx)(async (conn) => {
        const h = i.householdId
            ? (await (0, pool_1.query)(`SELECT h.id, h.booth_id FROM households h JOIN booths b ON b.id = h.booth_id
                WHERE h.id = ? AND h.deleted_at IS NULL AND b.organization_id = ?`, [i.householdId, u.organizationId], conn))[0]
            : (await (0, pool_1.query)(`SELECT h.id, h.booth_id FROM citizens ci JOIN households h ON h.id = ci.household_id
                JOIN booths b ON b.id = h.booth_id WHERE ci.voter_id = ? AND h.deleted_at IS NULL AND b.organization_id = ?`, [i.voterId.toUpperCase(), u.organizationId], conn))[0];
        if (!h)
            throw (0, errors_1.notFound)();
        if (u.boothIds.includes(h.booth_id))
            throw new errors_1.AppError(422, "NOT_CROSS_BOOTH", "Household is already in your booth");
        const target = (await (0, pool_1.query)("SELECT id FROM booths WHERE id = ? AND organization_id = ? AND status = 'ACTIVE'", [h.booth_id, u.organizationId], conn))[0];
        if (!target)
            throw (0, errors_1.notFound)();
        const dup = (await (0, pool_1.query)("SELECT id FROM cross_booth_requests WHERE requester_id = ? AND resource_id = ? AND action = ? AND status IN ('PENDING','APPROVED') AND (status = 'PENDING' AND expires_at > NOW(3) OR status = 'APPROVED' AND grant_expires_at > NOW(3))", [u.id, h.id, i.action], conn))[0];
        if (dup)
            throw (0, errors_1.conflict)("A pending request already exists");
        const id = (0, crypto_1.randomUUID)();
        await (0, pool_1.exec)(`INSERT INTO cross_booth_requests (id, requester_id, source_booth_id, target_booth_id, resource_type, resource_id, action, reason, expires_at)
       VALUES (?,?,?,?, 'HOUSEHOLD', ?, ?, ?, DATE_ADD(NOW(3), INTERVAL ${REQUEST_VALID_HOURS} HOUR))`, [id, u.id, i.sourceBoothId, h.booth_id, h.id, i.action, i.reason], conn);
        await (0, audit_1.audit)({ actorId: u.id, action: "CROSS_BOOTH_REQUEST", resourceType: "HOUSEHOLD", resourceId: h.id,
            scope: `${i.sourceBoothId}->${h.booth_id}`, outcome: "SUCCESS", requestId: c.requestId }, conn);
        return { id, status: "PENDING" };
    });
}
/** Requester sees own requests; approvers see requests targeting booths where they hold approver rights. */
async function listRequests(c) {
    const u = c.user;
    if (u.role !== "BOOTH_MEMBER")
        throw (0, errors_1.forbidden)();
    const a = u.approverBoothIds;
    const rows = await (0, pool_1.query)(`SELECT r.id, r.source_booth_id AS sourceBoothId, sb.code AS sourceBoothCode, r.target_booth_id AS targetBoothId, tb.code AS targetBoothCode, r.resource_type AS resourceType,
            r.resource_id AS resourceId, h.house_code AS houseCode, requester.full_name AS requesterName, r.action, r.reason, r.status, r.expires_at AS expiresAt,
            r.grant_expires_at AS grantExpiresAt, r.created_at AS createdAt, (r.requester_id = ?) AS mine
       FROM cross_booth_requests r JOIN households h ON h.id = r.resource_id
       JOIN booths sb ON sb.id = r.source_booth_id JOIN booths tb ON tb.id = r.target_booth_id
       JOIN users requester ON requester.id = r.requester_id
      WHERE r.requester_id = ? ${a.length ? `OR r.target_booth_id IN (${(0, pool_1.placeholders)(a.length)})` : ""}
      ORDER BY r.created_at DESC LIMIT 100`, [u.id, u.id, ...a]);
    return rows.map((r) => ({ ...r, mine: Boolean(r.mine), canDecide: !r.mine && r.status === "PENDING" && a.includes(r.targetBoothId) }));
}
async function getGrantedHousehold(c, requestId) {
    const u = c.user;
    const grant = (await (0, pool_1.query)(`SELECT r.id, r.action, r.resource_id AS householdId, r.source_booth_id AS sourceBoothId, r.target_booth_id AS boothId, h.house_code AS houseCode,
            h.verification_status AS status, b.code AS boothCode
       FROM cross_booth_requests r JOIN households h ON h.id = r.resource_id JOIN booths b ON b.id = r.target_booth_id AND b.status = 'ACTIVE'
       JOIN booth_assignments a ON a.booth_id = r.source_booth_id AND a.user_id = r.requester_id
      WHERE r.id = ? AND r.requester_id = ? AND r.status = 'APPROVED'
        AND r.grant_expires_at > NOW(3) AND a.revoked_at IS NULL AND a.starts_at <= NOW(3)
        AND (a.ends_at IS NULL OR a.ends_at > NOW(3)) AND h.deleted_at IS NULL`, [requestId, u.id]))[0];
    if (!grant || !u.boothIds.includes(grant.sourceBoothId))
        throw (0, errors_1.notFound)();
    const citizens = await (0, pool_1.query)(`SELECT ci.id, ci.full_name AS fullName, ci.relation, ci.voter_id AS voterId,
            ci.life_status AS lifeStatus,
            (SELECT COUNT(*) FROM verifications v WHERE v.citizen_id = ci.id AND v.result = 'PASSED') AS passedSteps
       FROM citizens ci WHERE ci.household_id = ? ORDER BY ci.full_name`, [grant.householdId]);
    return { requestId: grant.id, action: grant.action, household: { id: grant.householdId, houseCode: grant.houseCode, boothCode: grant.boothCode, status: grant.status }, citizens: citizens.map((citizen) => ({ ...citizen, voterId: (0, households_1.maskVoter)(citizen.voterId), passedSteps: Number(citizen.passedSteps) })) };
}
async function listAdminRequests(c) {
    return (0, pool_1.query)(`SELECT r.id, r.status, r.action, r.reason, r.created_at AS createdAt,
            r.expires_at AS expiresAt, r.grant_expires_at AS grantExpiresAt,
            r.decided_at AS decidedAt, h.house_code AS houseCode, requester.full_name AS requesterName,
            sb.code AS sourceBoothCode, tb.code AS targetBoothCode, approver.full_name AS approverName,
            (SELECT COUNT(*) FROM verifications v WHERE v.cross_booth_request_id = r.id) AS verificationCount
       FROM cross_booth_requests r JOIN households h ON h.id = r.resource_id
       JOIN booths sb ON sb.id = r.source_booth_id JOIN booths tb ON tb.id = r.target_booth_id
       JOIN users requester ON requester.id = r.requester_id
       LEFT JOIN users approver ON approver.id = r.approver_id
      WHERE sb.organization_id = ? AND tb.organization_id = ?
      ORDER BY r.created_at DESC LIMIT 200`, [c.user.organizationId, c.user.organizationId]);
}
async function decide(c, requestId, decision, grantHours) {
    const u = c.user;
    if (u.role !== "BOOTH_MEMBER")
        throw (0, errors_1.forbidden)();
    return (0, pool_1.tx)(async (conn) => {
        const r = (await (0, pool_1.query)("SELECT * FROM cross_booth_requests WHERE id = ? FOR UPDATE", [requestId], conn))[0];
        if (!r)
            throw (0, errors_1.notFound)();
        // Approver must hold approver rights on the TARGET booth right now (fresh DB state).
        if (!u.approverBoothIds.includes(r.target_booth_id) || r.requester_id === u.id) {
            await (0, audit_1.audit)({ actorId: u.id, action: "CROSS_BOOTH_" + (decision === "APPROVED" ? "APPROVAL" : "REJECTION"),
                resourceType: "CROSS_BOOTH_REQUEST", resourceId: r.id, outcome: "DENIED", reason: "not target-booth approver", requestId: c.requestId });
            throw (0, errors_1.forbidden)();
        }
        if (r.status !== "PENDING")
            throw (0, errors_1.conflict)("Request already decided"); // replay / double-approve protection
        const expired = (await (0, pool_1.query)("SELECT (? <= NOW(3)) AS e", [r.expires_at], conn))[0].e;
        if (expired) {
            await (0, pool_1.exec)("UPDATE cross_booth_requests SET status='EXPIRED' WHERE id = ? AND status='PENDING'", [r.id], conn);
            throw (0, errors_1.conflict)("Request expired");
        }
        const res = decision === "APPROVED"
            ? await (0, pool_1.exec)(`UPDATE cross_booth_requests SET status='APPROVED', approver_id=?, decided_at=NOW(3),
                      grant_expires_at=DATE_ADD(NOW(3), INTERVAL ${grantHours} HOUR) WHERE id=? AND status='PENDING'`, [u.id, r.id], conn)
            : await (0, pool_1.exec)("UPDATE cross_booth_requests SET status='REJECTED', approver_id=?, decided_at=NOW(3) WHERE id=? AND status='PENDING'", [u.id, r.id], conn);
        if (res.affectedRows !== 1)
            throw (0, errors_1.conflict)("Request already decided");
        await (0, audit_1.audit)({ actorId: u.id, action: "CROSS_BOOTH_" + (decision === "APPROVED" ? "APPROVAL" : "REJECTION"),
            resourceType: "CROSS_BOOTH_REQUEST", resourceId: r.id, scope: `${r.source_booth_id}->${r.target_booth_id}`, outcome: "SUCCESS", requestId: c.requestId }, conn);
        await (0, pool_1.exec)("INSERT INTO notification_outbox (id, user_id, type, payload) VALUES (?,?,?,?)", [(0, crypto_1.randomUUID)(), r.requester_id, "CROSS_BOOTH_" + decision, JSON.stringify({ requestId: r.id })], conn);
        return { id: r.id, status: decision };
    });
}
const approveRequest = (c, id, hours = 4) => decide(c, id, "APPROVED", Math.min(Math.max(hours, 1), 24));
exports.approveRequest = approveRequest;
const rejectRequest = (c, id) => decide(c, id, "REJECTED", 0);
exports.rejectRequest = rejectRequest;
