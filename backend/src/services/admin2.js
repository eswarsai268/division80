"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listEvents = exports.listAllAssignments = void 0;
exports.listCitizens = listCitizens;
exports.updateCitizen = updateCitizen;
exports.listHouseholds = listHouseholds;
exports.deleteHousehold = deleteHousehold;
exports.updateEvent = updateEvent;
exports.getComplaintAdmin = getComplaintAdmin;
exports.settings = settings;
exports.getProfile = getProfile;
exports.updateProfile = updateProfile;
exports.listVerificationsForBooths = listVerificationsForBooths;
const pool_1 = require("../db/pool");
const env_1 = require("../config/env");
const redis_1 = require("../cache/redis");
const errors_1 = require("../errors");
const households_1 = require("../repositories/households");
const audit_1 = require("./audit");
const org = (c) => c.user.organizationId;
const page = (rows, limit) => {
    const more = rows.length > limit;
    const items = more ? rows.slice(0, limit) : rows;
    return { items, nextCursor: more ? items[items.length - 1].id : null };
};
const esc = (s) => s.replace(/[\\%_]/g, (m) => "\\" + m);
async function listCitizens(c, f) {
    const where = ["b.organization_id = ?", "h.deleted_at IS NULL"];
    const p = [org(c)];
    if (f.boothId) {
        where.push("ci.booth_id = ?");
        p.push(f.boothId);
    }
    if (f.search) {
        where.push("ci.full_name LIKE ?");
        p.push(esc(f.search) + "%");
    }
    if (f.cursor) {
        where.push("ci.id > ?");
        p.push(f.cursor);
    }
    const rows = await (0, pool_1.query)(`SELECT ci.id, ci.full_name AS fullName, ci.relation, ci.voter_id AS voterId, ci.life_status AS lifeStatus, h.house_code AS houseCode, b.code AS boothCode,
            (SELECT COUNT(*) FROM verifications v WHERE v.citizen_id = ci.id AND v.result = 'PASSED') AS passedSteps
       FROM citizens ci JOIN households h ON h.id = ci.household_id JOIN booths b ON b.id = ci.booth_id
      WHERE ${where.join(" AND ")} ORDER BY ci.id LIMIT ${f.limit + 1}`, p);
    await (0, audit_1.audit)({ actorId: c.user.id, action: "CITIZEN_LIST_VIEW", resourceType: "CITIZEN", scope: f.boothId ? `booth:${f.boothId}` : "org", outcome: "SUCCESS", requestId: c.requestId });
    return page(rows.map((r) => ({ ...r, voterId: (0, households_1.maskVoter)(r.voterId), passedSteps: Number(r.passedSteps) })), f.limit);
}
async function updateCitizen(c, id, i) {
    const r = await (0, pool_1.exec)(`UPDATE citizens ci JOIN booths b ON b.id = ci.booth_id SET ci.full_name = COALESCE(?, ci.full_name), ci.life_status = COALESCE(?, ci.life_status)
                         WHERE ci.id = ? AND b.organization_id = ?`, [i.fullName ?? null, i.lifeStatus ?? null, id, org(c)]);
    if (r.affectedRows === 0)
        throw (0, errors_1.notFound)();
    await (0, audit_1.audit)({ actorId: c.user.id, action: "HOUSEHOLD_UPDATE", resourceType: "CITIZEN", resourceId: id, outcome: "SUCCESS", reason: Object.keys(i).join(","), requestId: c.requestId });
    return { id };
}
async function listHouseholds(c, f) {
    const where = ["b.organization_id = ?", "h.deleted_at IS NULL"];
    const p = [org(c)];
    if (f.boothId) {
        where.push("h.booth_id = ?");
        p.push(f.boothId);
    }
    if (f.status) {
        where.push("h.verification_status = ?");
        p.push(f.status);
    }
    if (f.search) {
        where.push("h.house_code LIKE ?");
        p.push(esc(f.search.toUpperCase()) + "%");
    }
    if (f.cursor) {
        where.push("h.id > ?");
        p.push(f.cursor);
    }
    const rows = await (0, pool_1.query)(`SELECT h.id, h.house_code AS houseCode, h.verification_status AS status, b.code AS boothCode,
            (SELECT COUNT(*) FROM citizens ci WHERE ci.household_id = h.id) AS members
       FROM households h JOIN booths b ON b.id = h.booth_id WHERE ${where.join(" AND ")} ORDER BY h.id LIMIT ${f.limit + 1}`, p);
    return page(rows.map((r) => ({ ...r, members: Number(r.members) })), f.limit);
}
async function deleteHousehold(c, id) {
    const r = await (0, pool_1.exec)("UPDATE households SET deleted_at = NOW(3) WHERE id = ? AND organization_id = ? AND deleted_at IS NULL", [id, org(c)]);
    if (r.affectedRows === 0)
        throw (0, errors_1.notFound)();
    await (0, audit_1.audit)({ actorId: c.user.id, action: "HOUSEHOLD_UPDATE", resourceType: "HOUSEHOLD", resourceId: id, outcome: "SUCCESS", reason: "soft-deleted", requestId: c.requestId });
    return { id };
}
const listAllAssignments = (c) => (0, pool_1.query)(`SELECT a.id, a.booth_id AS boothId, b.code AS boothCode, a.user_id AS userId, u.full_name AS fullName, a.can_approve_cross_booth AS canApprove, a.starts_at AS startsAt
     FROM booth_assignments a JOIN booths b ON b.id = a.booth_id JOIN users u ON u.id = a.user_id
    WHERE b.organization_id = ? AND a.revoked_at IS NULL ORDER BY b.code, u.full_name LIMIT 500`, [org(c)]);
exports.listAllAssignments = listAllAssignments;
const listEvents = (c) => (0, pool_1.query)("SELECT id, kind, title, body, starts_at AS startsAt, status, published_at AS publishedAt FROM events WHERE organization_id = ? ORDER BY created_at DESC LIMIT 100", [org(c)]);
exports.listEvents = listEvents;
async function updateEvent(c, id, i) {
    const r = await (0, pool_1.exec)("UPDATE events SET title = COALESCE(?, title), body = COALESCE(?, body), starts_at = COALESCE(?, starts_at) WHERE id = ? AND organization_id = ? AND status <> 'ARCHIVED'", [i.title ?? null, i.body ?? null, i.startsAt ? new Date(i.startsAt) : null, id, org(c)]);
    if (r.affectedRows === 0)
        throw (0, errors_1.notFound)();
    await (0, audit_1.audit)({ actorId: c.user.id, action: "EVENT_UPDATE", resourceType: "EVENT", resourceId: id, outcome: "SUCCESS", requestId: c.requestId });
    return { id };
}
async function getComplaintAdmin(c, id) {
    const r = (await (0, pool_1.query)(`SELECT c.id, c.title, c.description, c.category, c.location, c.status, c.assigned_booth_id AS assignedBoothId, c.version, c.created_at AS createdAt, u.full_name AS submittedBy
       FROM complaints c JOIN users u ON u.id = c.user_id WHERE c.id = ? AND c.organization_id = ?`, [id, org(c)]))[0];
    if (!r)
        throw (0, errors_1.notFound)();
    const timeline = await (0, pool_1.query)("SELECT from_status AS fromStatus, to_status AS toStatus, note, created_at AS createdAt FROM complaint_status_history WHERE complaint_id = ? ORDER BY created_at", [id]);
    return { ...r, timeline };
}
async function settings(c) {
    const o = (await (0, pool_1.query)("SELECT name, slug FROM organizations WHERE id = ?", [org(c)]))[0];
    const media = (await (0, pool_1.query)("SELECT login_video_url AS loginVideoUrl FROM organization_settings WHERE organization_id = ?", [org(c)]))[0];
    return {
        organization: o,
        loginVideoUrl: media?.loginVideoUrl ?? null,
        security: { accessTokenMinutes: Math.round(env_1.env.ACCESS_TOKEN_TTL_SECONDS / 60), refreshTokenDays: env_1.env.REFRESH_TOKEN_TTL_DAYS, minPasswordLength: 12,
            passwordHashing: "argon2id", cookiesSecure: env_1.env.NODE_ENV === "production", rateLimitStore: redis_1.redis ? "redis" : "memory (single instance only)" },
        limits: { maxImportRows: 50000, exportExpiryHours: 24, maxPhotosPerComplaint: 3, maxPhotoMB: 5 },
    };
}
async function updateLoginVideo(c, loginVideoUrl) {
    if (loginVideoUrl !== null) {
        let parsed;
        try {
            parsed = new URL(loginVideoUrl);
        }
        catch {
            throw new errors_1.AppError(422, "INVALID_VIDEO_URL", "Use a valid Cloudinary video delivery URL");
        }
        const segments = parsed.pathname.split("/").filter(Boolean);
        if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com" || parsed.username || parsed.password || parsed.port
            || segments.length < 4 || segments[1] !== "video" || segments[2] !== "upload") {
            throw new errors_1.AppError(422, "INVALID_VIDEO_URL", "Use an HTTPS res.cloudinary.com/<cloud>/video/upload/... URL");
        }
    }
    await (0, pool_1.exec)(`INSERT INTO organization_settings (organization_id, login_video_url, updated_by)
      VALUES (?,?,?) ON DUPLICATE KEY UPDATE login_video_url = VALUES(login_video_url), updated_by = VALUES(updated_by)`, [org(c), loginVideoUrl, c.user.id]);
    await (0, audit_1.audit)({ actorId: c.user.id, action: "LOGIN_MEDIA_UPDATE", resourceType: "ORGANIZATION_SETTING", outcome: "SUCCESS", reason: loginVideoUrl ? "Cloudinary video updated" : "Cloudinary video removed", requestId: c.requestId });
    return { loginVideoUrl };
}
exports.updateLoginVideo = updateLoginVideo;
async function getProfile(userId) {
    const u = (await (0, pool_1.query)("SELECT id, email, full_name AS fullName, phone, role, created_at AS createdAt FROM users WHERE id = ?", [userId]))[0];
    if (!u)
        throw (0, errors_1.notFound)();
    return u;
}
async function updateProfile(userId, i) {
    await (0, pool_1.exec)("UPDATE users SET full_name = COALESCE(?, full_name), phone = ? WHERE id = ?", [i.fullName ?? null, i.phone === undefined ? (await getProfile(userId)).phone : i.phone, userId]);
    return getProfile(userId);
}
async function listVerificationsForBooths(c) {
    if (c.user.boothIds.length === 0)
        return [];
    return (0, pool_1.query)(`SELECT v.id, v.step, v.result, v.created_at AS createdAt, h.house_code AS houseCode, ci.full_name AS citizenName, u.full_name AS verifier
       FROM verifications v JOIN households h ON h.id = v.household_id JOIN citizens ci ON ci.id = v.citizen_id JOIN users u ON u.id = v.verifier_id
      WHERE v.booth_id IN (${(0, pool_1.placeholders)(c.user.boothIds.length)}) ORDER BY v.created_at DESC LIMIT 100`, c.user.boothIds);
}
