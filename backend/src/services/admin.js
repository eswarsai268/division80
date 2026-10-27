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
exports.dashboard = dashboard;
exports.createEvent = createEvent;
exports.setEventStatus = setEventStatus;
const crypto_1 = require("crypto");
const pool_1 = require("../db/pool");
const errors_1 = require("../errors");
const password_1 = require("../auth/password");
const publicContent_1 = require("./publicContent");
const phone_1 = require("../utils/phone");
const redis_1 = require("../cache/redis");
const jsonCache_1 = require("../cache/jsonCache");
// Every query below is constrained by c.user.organizationId (admin scope), never by client input.
const org = (c) => c.user.organizationId;
async function createBooth(c, i) {
    const boothId = (0, crypto_1.randomUUID)();
    const memberId = i.member ? (0, crypto_1.randomUUID)() : null;
    const passwordHash = i.member ? await (0, password_1.hashPassword)(i.member.password) : null;
    try {
        return await (0, pool_1.tx)(async (conn) => {
            await (0, pool_1.exec)("INSERT INTO booths (id, organization_id, code, name) VALUES (?,?,?,?)", [boothId, org(c), i.code, i.name], conn);
            if (i.member) {
                await createBoothMemberAccount(c, boothId, i.member, memberId, passwordHash, conn);
            }
            return { id: boothId, ...(memberId ? { memberId } : {}) };
        });
    }
    catch (e) {
        if (e?.code === "ER_DUP_ENTRY")
            throw (0, errors_1.conflict)(i.member ? "Booth code or member phone already exists" : "Booth code already exists");
        throw e;
    }
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
    return { id };
}
async function assignMember(c, boothId, i) {
    return (0, pool_1.tx)(async (conn) => {
        // Match updateUser and lockActiveBoothAssignment: user -> assignment -> booth.
        // Revalidate role/status while holding the user row lock so suspension or demotion
        // cannot race an assignment into existence after its revocation pass.
        const u = (await (0, pool_1.query)("SELECT id FROM users WHERE id = ? AND organization_id = ? AND role = 'BOOTH_MEMBER' AND status = 'ACTIVE' FOR UPDATE", [i.userId, org(c)], conn))[0];
        if (!u)
            throw (0, errors_1.notFound)();
        const existing = (await (0, pool_1.query)("SELECT id FROM booth_assignments WHERE booth_id = ? AND user_id = ? AND revoked_at IS NULL FOR UPDATE", [boothId, i.userId], conn))[0];
        const b = (await (0, pool_1.query)("SELECT id FROM booths WHERE id = ? AND organization_id = ? AND status = 'ACTIVE' FOR UPDATE", [boothId, org(c)], conn))[0];
        if (!b)
            throw (0, errors_1.notFound)();
        if (existing)
            return { id: existing.id, alreadyAssigned: true };
        const id = (0, crypto_1.randomUUID)();
        try {
            await (0, pool_1.exec)("INSERT INTO booth_assignments (id, booth_id, user_id, created_by) VALUES (?,?,?,?)", [id, boothId, i.userId, c.user.id], conn);
        }
        catch (e) { // unique(active_key) makes concurrent duplicate assignment impossible
            if (e?.code === "ER_DUP_ENTRY") {
                const duplicate = (await (0, pool_1.query)("SELECT id FROM booth_assignments WHERE booth_id = ? AND user_id = ? AND revoked_at IS NULL", [boothId, i.userId], conn))[0];
                if (duplicate)
                    return { id: duplicate.id, alreadyAssigned: true };
                throw (0, errors_1.conflict)("Member already assigned to this booth");
            }
            throw e;
        }
        return { id };
    });
}
async function listAssignments(c, boothId) {
    await getBooth(c, boothId);
    return (0, pool_1.query)(`SELECT a.id, a.user_id AS userId, u.full_name AS fullName, a.starts_at AS startsAt, a.ends_at AS endsAt
                  FROM booth_assignments a JOIN users u ON u.id = a.user_id WHERE a.booth_id = ? AND a.revoked_at IS NULL`, [boothId]);
}
async function revokeAssignment(c, id) {
    const r = await (0, pool_1.exec)(`UPDATE booth_assignments a JOIN booths b ON b.id = a.booth_id
        SET a.revoked_at = NOW(3), a.revoked_by = ? WHERE a.id = ? AND a.revoked_at IS NULL AND b.organization_id = ?`, [c.user.id, id, org(c)]);
    if (r.affectedRows === 0)
        throw (0, errors_1.notFound)();
    return { id };
}
const listUsers = (c, role) => (0, pool_1.query)(`SELECT id, email, phone, full_name AS fullName, role, status FROM users WHERE organization_id = ? AND role IN ('ADMIN','BOOTH_MEMBER') ${role ? "AND role = ?" : ""} ORDER BY created_at DESC LIMIT 200`, role ? [org(c), role] : [org(c)]);
exports.listUsers = listUsers;
/** Admins create booth members with a temporary password. Creating ADMINs is deliberately NOT possible via API. */
async function createUser(c, i) {
    const id = (0, crypto_1.randomUUID)();
    if (i.role === "BOOTH_MEMBER" && !i.boothId)
        throw new errors_1.AppError(422, "BOOTH_REQUIRED", "Select a booth for this booth member");
    const phone = (0, phone_1.normalizePhone)(i.phone);
    if (!/^\+?[1-9]\d{7,14}$/.test(phone))
        throw new errors_1.AppError(422, "INVALID_PHONE", "Enter a valid phone number");
    const passwordHash = await (0, password_1.hashPassword)(i.password);
    try {
        return await (0, pool_1.tx)(async (conn) => {
            if (i.role === "BOOTH_MEMBER") {
                await createBoothMemberAccount(c, i.boothId, { ...i, phone }, id, passwordHash, conn);
                return { id };
            }
            throw new errors_1.AppError(422, "INVALID_ROLE", "Only booth member accounts can be created here");
        });
    }
    catch (e) {
        if (e?.code === "ER_DUP_ENTRY")
            throw (0, errors_1.conflict)("A user with this phone number already exists");
        throw e;
    }
}
async function createBoothMemberAccount(c, boothId, member, userId, passwordHash, conn) {
    const booth = (await (0, pool_1.query)("SELECT id FROM booths WHERE id = ? AND organization_id = ? AND status = 'ACTIVE' FOR UPDATE", [boothId, org(c)], conn))[0];
    if (!booth)
        throw (0, errors_1.notFound)();
    const phone = (0, phone_1.normalizePhone)(member.phone);
    if (!/^\+?[1-9]\d{7,14}$/.test(phone))
        throw new errors_1.AppError(422, "INVALID_PHONE", "Enter a valid phone number");
    await (0, pool_1.exec)("INSERT INTO users (id, organization_id, email, phone, password_hash, full_name, role) VALUES (?,?,NULL,?,?,?,'BOOTH_MEMBER')", [userId, org(c), phone, passwordHash, member.fullName], conn);
    const assignmentId = (0, crypto_1.randomUUID)();
    await (0, pool_1.exec)("INSERT INTO booth_assignments (id, booth_id, user_id, created_by) VALUES (?,?,?,?)", [assignmentId, boothId, userId, c.user.id], conn);
    return { id: userId, assignmentId };
}
async function updateUser(c, id, i) {
    if (id === c.user.id)
        throw new errors_1.AppError(422, "SELF_MODIFICATION", "You cannot modify your own account");
    return (0, pool_1.tx)(async (conn) => {
        const t = (await (0, pool_1.query)("SELECT id, role FROM users WHERE id = ? AND organization_id = ? FOR UPDATE", [id, org(c)], conn))[0];
        if (!t)
            throw (0, errors_1.notFound)();
        if (t.role !== "BOOTH_MEMBER")
            throw new errors_1.AppError(403, "FORBIDDEN", "Admin accounts cannot be modified here");
        await (0, pool_1.exec)("UPDATE users SET status = COALESCE(?, status) WHERE id = ?", [i.status ?? null, id], conn);
        if (i.status === "SUSPENDED") {
            await (0, pool_1.exec)("UPDATE sessions SET revoked_at = NOW(3) WHERE user_id = ? AND revoked_at IS NULL", [id], conn);
        }
        return { id };
    });
}
async function dashboard(c) {
    const o = org(c);
    const key = (0, jsonCache_1.redisCacheKey)("dashboard", "admin", o);
    return (0, jsonCache_1.getOrLoadJson)(redis_1.redis, key, 10, async () => {
        const one = async (sql, p = [o]) => Number((await (0, pool_1.query)(sql, p))[0].n);
        return {
            booths: await one("SELECT COUNT(*) n FROM booths WHERE organization_id = ? AND status='ACTIVE'"),
            boothMembers: await one("SELECT COUNT(DISTINCT a.user_id) n FROM booth_assignments a JOIN booths b ON b.id=a.booth_id WHERE b.organization_id=? AND a.revoked_at IS NULL"),
            households: await one("SELECT COUNT(*) n FROM households WHERE organization_id = ? AND deleted_at IS NULL"),
            upcomingEvents: await one("SELECT COUNT(*) n FROM events WHERE organization_id = ? AND status='PUBLISHED' AND starts_at > NOW(3)"),
        };
    });
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
    await (0, publicContent_1.invalidatePublicContent)();
    return { id, status };
}
