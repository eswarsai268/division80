"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = exports.listBooths = void 0;
exports.createBooth = createBooth;
exports.getBooth = getBooth;
exports.updateBooth = updateBooth;
exports.assignMember = assignMember;
exports.listAssignments = listAssignments;
exports.revokeAssignment = revokeAssignment;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.listAudit = listAudit;
exports.dashboard = dashboard;
exports.createEvent = createEvent;
exports.setEventStatus = setEventStatus;
const crypto_1 = require("crypto");
const pool_1 = require("../db/pool");
const errors_1 = require("../errors");
const password_1 = require("../auth/password");
const audit_1 = require("./audit");
// Every query below is constrained by c.user.organizationId (admin scope), never by client input.
const org = (c) => c.user.organizationId;
async function createBooth(c, i) {
    const id = (0, crypto_1.randomUUID)();
    await (0, pool_1.exec)("INSERT INTO booths (id, organization_id, code, name) VALUES (?,?,?,?)", [id, org(c), i.code, i.name]);
    await (0, audit_1.audit)({ actorId: c.user.id, action: "BOOTH_CREATE", resourceType: "BOOTH", resourceId: id, outcome: "SUCCESS", requestId: c.requestId });
    return { id };
}
const listBooths = (c) => (0, pool_1.query)("SELECT id, code, name, status, created_at AS createdAt FROM booths WHERE organization_id = ? ORDER BY code", [org(c)]);
exports.listBooths = listBooths;
async function getBooth(c, id) {
    const b = (await (0, pool_1.query)(`SELECT b.id, b.code, b.name, b.status,
            (SELECT COUNT(*) FROM households h WHERE h.booth_id = b.id AND h.deleted_at IS NULL) AS households
       FROM booths b WHERE b.id = ? AND b.organization_id = ?`, [id, org(c)]))[0];
    if (!b)
        throw (0, errors_1.notFound)();
    return { ...b, households: Number(b.households) };
}
async function updateBooth(c, id, i) {
    const r = await (0, pool_1.exec)("UPDATE booths SET name = COALESCE(?, name), status = COALESCE(?, status) WHERE id = ? AND organization_id = ?", [i.name ?? null, i.status ?? null, id, org(c)]);
    if (r.affectedRows === 0)
        throw (0, errors_1.notFound)();
    await (0, audit_1.audit)({ actorId: c.user.id, action: "BOOTH_UPDATE", resourceType: "BOOTH", resourceId: id, outcome: "SUCCESS", requestId: c.requestId });
    return { id };
}
async function assignMember(c, boothId, i) {
    return (0, pool_1.tx)(async (conn) => {
        const b = (await (0, pool_1.query)("SELECT id FROM booths WHERE id = ? AND organization_id = ? AND status = 'ACTIVE' FOR UPDATE", [boothId, org(c)], conn))[0];
        const u = (await (0, pool_1.query)("SELECT id FROM users WHERE id = ? AND organization_id = ? AND role = 'BOOTH_MEMBER' AND status = 'ACTIVE'", [i.userId, org(c)], conn))[0];
        if (!b || !u)
            throw (0, errors_1.notFound)();
        const id = (0, crypto_1.randomUUID)();
        try {
            await (0, pool_1.exec)("INSERT INTO booth_assignments (id, booth_id, user_id, can_approve_cross_booth, created_by) VALUES (?,?,?,?,?)", [id, boothId, i.userId, i.canApproveCrossBooth ? 1 : 0, c.user.id], conn);
        }
        catch (e) { // unique(active_key) makes concurrent duplicate assignment impossible
            if (e?.code === "ER_DUP_ENTRY")
                throw (0, errors_1.conflict)("Member already assigned to this booth");
            throw e;
        }
        await (0, audit_1.audit)({ actorId: c.user.id, action: "BOOTH_ASSIGNMENT", resourceType: "BOOTH", resourceId: boothId, scope: `user:${i.userId}`, outcome: "SUCCESS", requestId: c.requestId }, conn);
        return { id };
    });
}
async function listAssignments(c, boothId) {
    await getBooth(c, boothId);
    return (0, pool_1.query)(`SELECT a.id, a.user_id AS userId, u.full_name AS fullName, a.can_approve_cross_booth AS canApprove, a.starts_at AS startsAt, a.ends_at AS endsAt
                  FROM booth_assignments a JOIN users u ON u.id = a.user_id WHERE a.booth_id = ? AND a.revoked_at IS NULL`, [boothId]);
}
async function revokeAssignment(c, id) {
    const r = await (0, pool_1.exec)(`UPDATE booth_assignments a JOIN booths b ON b.id = a.booth_id
        SET a.revoked_at = NOW(3), a.revoked_by = ? WHERE a.id = ? AND a.revoked_at IS NULL AND b.organization_id = ?`, [c.user.id, id, org(c)]);
    if (r.affectedRows === 0)
        throw (0, errors_1.notFound)();
    await (0, audit_1.audit)({ actorId: c.user.id, action: "BOOTH_REVOCATION", resourceType: "ASSIGNMENT", resourceId: id, outcome: "SUCCESS", requestId: c.requestId });
    return { id };
}
const listUsers = (c, role) => (0, pool_1.query)(`SELECT id, email, full_name AS fullName, role, status FROM users WHERE organization_id = ? ${role ? "AND role = ?" : ""} ORDER BY created_at DESC LIMIT 200`, role ? [org(c), role] : [org(c)]);
exports.listUsers = listUsers;
/** Admins create booth members with a temporary password. Creating ADMINs is deliberately NOT possible via API. */
async function createUser(c, i) {
    const id = (0, crypto_1.randomUUID)();
    await (0, pool_1.exec)("INSERT INTO users (id, organization_id, email, password_hash, full_name, role) VALUES (?,?,?,?,?,?)", [id, org(c), i.email.toLowerCase(), await (0, password_1.hashPassword)(i.password), i.fullName, i.role]);
    await (0, audit_1.audit)({ actorId: c.user.id, action: "ROLE_CHANGE", resourceType: "USER", resourceId: id, reason: `created as ${i.role}`, outcome: "SUCCESS", requestId: c.requestId });
    return { id };
}
async function updateUser(c, id, i) {
    if (id === c.user.id)
        throw new errors_1.AppError(422, "SELF_MODIFICATION", "You cannot modify your own account");
    return (0, pool_1.tx)(async (conn) => {
        const t = (await (0, pool_1.query)("SELECT id, role FROM users WHERE id = ? AND organization_id = ? FOR UPDATE", [id, org(c)], conn))[0];
        if (!t)
            throw (0, errors_1.notFound)();
        if (t.role === "ADMIN")
            throw new errors_1.AppError(403, "FORBIDDEN", "Admin accounts cannot be modified here");
        await (0, pool_1.exec)("UPDATE users SET status = COALESCE(?, status), role = COALESCE(?, role) WHERE id = ?", [i.status ?? null, i.role ?? null, id], conn);
        if (i.status === "SUSPENDED" || i.role) {
            await (0, pool_1.exec)("UPDATE sessions SET revoked_at = NOW(3) WHERE user_id = ? AND revoked_at IS NULL", [id], conn);
            if (i.role === "USER")
                await (0, pool_1.exec)("UPDATE booth_assignments SET revoked_at = NOW(3), revoked_by = ? WHERE user_id = ? AND revoked_at IS NULL", [c.user.id, id], conn);
        }
        await (0, audit_1.audit)({ actorId: c.user.id, action: i.status === "SUSPENDED" ? "ACCOUNT_SUSPENSION" : "ROLE_CHANGE", resourceType: "USER", resourceId: id,
            reason: [i.status, i.role].filter(Boolean).join(","), outcome: "SUCCESS", requestId: c.requestId }, conn);
        return { id };
    });
}
function listAudit(c, limit) {
    return (0, pool_1.query)(`SELECT a.id, a.actor_id AS actorId, a.action, a.resource_type AS resourceType, a.resource_id AS resourceId,
            a.scope, a.outcome, a.reason, a.request_id AS requestId, a.created_at AS createdAt
       FROM audit_logs a JOIN users u ON u.id = a.actor_id WHERE u.organization_id = ? ORDER BY a.created_at DESC LIMIT ${limit}`, [org(c)]);
}
async function dashboard(c) {
    const o = org(c);
    const one = async (sql, p = [o]) => Number((await (0, pool_1.query)(sql, p))[0].n);
    return {
        booths: await one("SELECT COUNT(*) n FROM booths WHERE organization_id = ? AND status='ACTIVE'"),
        boothMembers: await one("SELECT COUNT(DISTINCT a.user_id) n FROM booth_assignments a JOIN booths b ON b.id=a.booth_id WHERE b.organization_id=? AND a.revoked_at IS NULL"),
        households: await one("SELECT COUNT(*) n FROM households WHERE organization_id = ? AND deleted_at IS NULL"),
        pendingComplaints: await one("SELECT COUNT(*) n FROM complaints WHERE organization_id = ? AND status IN ('SUBMITTED','UNDER_REVIEW','ASSIGNED')"),
        inVerification: await one("SELECT COUNT(*) n FROM complaints WHERE organization_id = ? AND status = 'IN_VERIFICATION'"),
        resolved: await one("SELECT COUNT(*) n FROM complaints WHERE organization_id = ? AND status = 'RESOLVED'"),
        upcomingEvents: await one("SELECT COUNT(*) n FROM events WHERE organization_id = ? AND status='PUBLISHED' AND starts_at > NOW(3)"),
    };
}
async function createEvent(c, i) {
    const id = (0, crypto_1.randomUUID)();
    await (0, pool_1.exec)("INSERT INTO events (id, organization_id, kind, title, body, starts_at, created_by) VALUES (?,?,?,?,?,?,?)", [id, org(c), i.kind, i.title, i.body, i.startsAt ? new Date(i.startsAt) : null, c.user.id]);
    return { id };
}
async function setEventStatus(c, id, status) {
    const r = await (0, pool_1.exec)("UPDATE events SET status = ?, published_at = IF(? = 'PUBLISHED', NOW(3), published_at) WHERE id = ? AND organization_id = ?", [status, status, id, org(c)]);
    if (r.affectedRows === 0)
        throw (0, errors_1.notFound)();
    await (0, audit_1.audit)({ actorId: c.user.id, action: "EVENT_" + status, resourceType: "EVENT", resourceId: id, outcome: "SUCCESS", requestId: c.requestId });
    return { id, status };
}
