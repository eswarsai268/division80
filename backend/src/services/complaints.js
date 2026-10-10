"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createComplaint = createComplaint;
exports.listMine = listMine;
exports.getOwn = getOwn;
exports.timelineOwn = timelineOwn;
exports.listForBooth = listForBooth;
exports.getForBooth = getForBooth;
exports.adminList = adminList;
exports.adminUpdate = adminUpdate;
const crypto_1 = require("crypto");
const pool_1 = require("../db/pool");
const errors_1 = require("../errors");
const audit_1 = require("./audit");
const COLS = `c.id, c.title, c.description, c.category, c.location, c.status, c.assigned_booth_id AS assignedBoothId,
              c.version, c.created_at AS createdAt, c.updated_at AS updatedAt`;
async function createComplaint(c, i) {
    if (c.user.role !== "USER")
        throw (0, errors_1.forbidden)();
    const id = (0, crypto_1.randomUUID)();
    await (0, pool_1.tx)(async (conn) => {
        // user_id and organization come from the session, never from the request body
        await (0, pool_1.exec)(`INSERT INTO complaints (id, organization_id, user_id, title, description, category, location) VALUES (?,?,?,?,?,?,?)`, [id, c.user.organizationId, c.user.id, i.title, i.description, i.category, i.location ?? null], conn);
        await (0, pool_1.exec)("INSERT INTO complaint_status_history (id, complaint_id, from_status, to_status, actor_id) VALUES (?,?,NULL,'SUBMITTED',?)", [(0, crypto_1.randomUUID)(), id, c.user.id], conn);
        await (0, pool_1.exec)("INSERT INTO notification_outbox (id, user_id, type, payload) VALUES (?,?,?,?)", [(0, crypto_1.randomUUID)(), c.user.id, "COMPLAINT_SUBMITTED", JSON.stringify({ complaintId: id })], conn);
    });
    return { id, status: "SUBMITTED" };
}
async function listMine(c, limit, cursor) {
    const rows = await (0, pool_1.query)(`SELECT ${COLS} FROM complaints c WHERE c.user_id = ? ${cursor ? "AND c.id > ?" : ""} ORDER BY c.id LIMIT ${limit + 1}`, cursor ? [c.user.id, cursor] : [c.user.id]);
    const more = rows.length > limit;
    const items = more ? rows.slice(0, limit) : rows;
    return { items, nextCursor: more ? items[items.length - 1].id : null };
}
/** Owner-only. Someone else's complaint is indistinguishable from a missing one (404). */
async function getOwn(c, id) {
    const r = (await (0, pool_1.query)(`SELECT ${COLS} FROM complaints c WHERE c.id = ? AND c.user_id = ?`, [id, c.user.id]))[0];
    if (!r)
        throw (0, errors_1.notFound)();
    return r;
}
async function timelineOwn(c, id) {
    await getOwn(c, id);
    return (0, pool_1.query)("SELECT from_status AS fromStatus, to_status AS toStatus, note, created_at AS createdAt FROM complaint_status_history WHERE complaint_id = ? ORDER BY created_at", [id]);
}
async function listForBooth(c, status) {
    if (c.user.boothIds.length === 0)
        return [];
    return (0, pool_1.query)(`SELECT ${COLS} FROM complaints c WHERE c.assigned_booth_id IN (${(0, pool_1.placeholders)(c.user.boothIds.length)}) ${status ? "AND c.status = ?" : ""}
     ORDER BY c.updated_at DESC LIMIT 100`, status ? [...c.user.boothIds, status] : c.user.boothIds);
}
async function getForBooth(c, id) {
    if (c.user.boothIds.length === 0)
        throw (0, errors_1.notFound)();
    const r = (await (0, pool_1.query)(`SELECT ${COLS} FROM complaints c WHERE c.id = ? AND c.assigned_booth_id IN (${(0, pool_1.placeholders)(c.user.boothIds.length)})`, [id, ...c.user.boothIds]))[0];
    if (!r)
        throw (0, errors_1.notFound)();
    return r;
}
const TRANSITIONS = {
    SUBMITTED: ["UNDER_REVIEW", "REJECTED"], UNDER_REVIEW: ["ASSIGNED", "REJECTED"],
    ASSIGNED: ["IN_VERIFICATION", "REJECTED"], IN_VERIFICATION: ["RESOLVED", "ASSIGNED"],
    RESOLVED: ["REOPENED"], REOPENED: ["UNDER_REVIEW"],
};
async function adminList(c, f) {
    const rows = await (0, pool_1.query)(`SELECT ${COLS} FROM complaints c WHERE c.organization_id = ? ${f.status ? "AND c.status = ?" : ""} ${f.cursor ? "AND c.id > ?" : ""}
     ORDER BY c.id LIMIT ${f.limit + 1}`, [c.user.organizationId, ...(f.status ? [f.status] : []), ...(f.cursor ? [f.cursor] : [])]);
    const more = rows.length > f.limit;
    const items = more ? rows.slice(0, f.limit) : rows;
    return { items, nextCursor: more ? items[items.length - 1].id : null };
}
async function adminUpdate(c, id, i) {
    return (0, pool_1.tx)(async (conn) => {
        const r = (await (0, pool_1.query)("SELECT id, user_id, status, version, assigned_booth_id FROM complaints WHERE id = ? AND organization_id = ? FOR UPDATE", [id, c.user.organizationId], conn))[0];
        if (!r)
            throw (0, errors_1.notFound)();
        if (i.expectedVersion !== undefined && i.expectedVersion !== r.version)
            throw (0, errors_1.conflict)("Complaint was modified by someone else");
        let boothId = r.assigned_booth_id;
        if (i.assignedBoothId) {
            const b = (await (0, pool_1.query)("SELECT id FROM booths WHERE id = ? AND organization_id = ? AND status='ACTIVE'", [i.assignedBoothId, c.user.organizationId], conn))[0];
            if (!b)
                throw (0, errors_1.notFound)();
            boothId = b.id;
        }
        const to = i.status ?? r.status;
        if (i.status && !(TRANSITIONS[r.status] ?? []).includes(i.status))
            throw new errors_1.AppError(409, "INVALID_TRANSITION", `Cannot move ${r.status} -> ${i.status}`);
        if (to === "ASSIGNED" && !boothId)
            throw new errors_1.AppError(422, "BOOTH_REQUIRED", "Assign a booth first");
        await (0, pool_1.exec)("UPDATE complaints SET status = ?, assigned_booth_id = ?, version = version + 1 WHERE id = ?", [to, boothId, id], conn);
        if (i.status) {
            await (0, pool_1.exec)("INSERT INTO complaint_status_history (id, complaint_id, from_status, to_status, actor_id, note) VALUES (?,?,?,?,?,?)", [(0, crypto_1.randomUUID)(), id, r.status, to, c.user.id, i.note ?? null], conn);
            await (0, pool_1.exec)("INSERT INTO notification_outbox (id, user_id, type, payload) VALUES (?,?,?,?)", [(0, crypto_1.randomUUID)(), r.user_id, "COMPLAINT_STATUS", JSON.stringify({ complaintId: id, status: to })], conn);
        }
        await (0, audit_1.audit)({ actorId: c.user.id, action: to === "RESOLVED" ? "COMPLAINT_RESOLUTION" : "COMPLAINT_ASSIGNMENT",
            resourceType: "COMPLAINT", resourceId: id, outcome: "SUCCESS", reason: `${r.status}->${to}`, requestId: c.requestId }, conn);
        return { id, status: to, version: r.version + 1 };
    });
}
