"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listEvents = exports.listAllAssignments = void 0;
exports.listCitizens = listCitizens;
exports.createCitizen = createCitizen;
exports.archiveCitizen = archiveCitizen;
exports.updateCitizen = updateCitizen;
exports.listHouseholds = listHouseholds;
exports.deleteHousehold = deleteHousehold;
exports.updateEvent = updateEvent;
exports.settings = settings;
exports.listVerificationsForBooths = listVerificationsForBooths;
exports.listDeadPeople = listDeadPeople;
exports.freezeDeadPerson = freezeDeadPerson;
exports.unfreezeDeadPerson = unfreezeDeadPerson;
exports.listDFlagPeople = listDFlagPeople;
exports.freezeDFlagPerson = freezeDFlagPerson;
exports.unfreezeDFlagPerson = unfreezeDFlagPerson;
const pool_1 = require("../db/pool");
const env_1 = require("../config/env");
const redis_1 = require("../cache/redis");
const errors_1 = require("../errors");
const households_1 = require("../repositories/households");
const publicContent_1 = require("./publicContent");
const org = (c) => c.user.organizationId;
const page = (rows, limit) => {
    const more = rows.length > limit;
    const items = more ? rows.slice(0, limit) : rows;
    return { items, nextCursor: more ? items[items.length - 1].id : null };
};
const esc = (s) => s.replace(/[\\%_]/g, (m) => "\\" + m);
async function listCitizens(c, f) {
    const where = ["b.organization_id = ?", "h.deleted_at IS NULL", "ci.deleted_at IS NULL"];
    const p = [org(c)];
    if (f.boothId) {
        where.push("ci.booth_id = ?");
        p.push(f.boothId);
    }
    if (f.pollingStation) {
        where.push("ci.polling_station = ?");
        p.push(f.pollingStation);
    }
    if (f.search) {
        where.push("(ci.full_name LIKE ? OR ci.voter_id LIKE ? OR h.house_code LIKE ? OR ci.polling_station LIKE ?)");
        const term = esc(f.search) + "%";
        p.push(term, term, term.toUpperCase(), term);
    }
    if (f.cursor) {
        where.push("ci.id > ?");
        p.push(f.cursor);
    }
    const rows = await (0, pool_1.query)(`SELECT ci.id, ci.full_name AS fullName, ci.father_or_husband_name AS fatherOrHusbandName, ci.relation, ci.voter_id AS voterId, ci.life_status AS lifeStatus,
            ci.roll_serial AS rollSerial, ci.age, ci.gender, h.address_line AS address, h.house_code AS houseCode, b.code AS boothCode,
            ci.polling_station AS pollingStation, ci.polling_address AS pollingAddress, ci.d_flag AS dFlag,
            (SELECT COUNT(*) FROM verifications v WHERE v.citizen_id = ci.id AND v.result = 'PASSED') AS passedSteps
       FROM citizens ci JOIN households h ON h.id = ci.household_id JOIN booths b ON b.id = ci.booth_id
      WHERE ${where.join(" AND ")} ORDER BY ci.id LIMIT ${f.limit + 1}`, p);
    return page(rows.map((r) => ({ ...r, voterId: (0, households_1.maskVoter)(r.voterId), passedSteps: Number(r.passedSteps) })), f.limit);
}
async function updateCitizen(c, id, i) {
    const r = await (0, pool_1.exec)(`UPDATE citizens ci JOIN booths b ON b.id = ci.booth_id SET ci.full_name = COALESCE(?, ci.full_name), ci.life_status = COALESCE(?, ci.life_status)
                         WHERE ci.id = ? AND b.organization_id = ?`, [i.fullName ?? null, i.lifeStatus ?? null, id, org(c)]);
    if (r.affectedRows === 0)
        throw (0, errors_1.notFound)();
    return { id };
}
async function createCitizen(c, input) {
    const id = require("crypto").randomUUID();
    return (0, pool_1.tx)(async (conn) => {
        const booth = (await (0, pool_1.query)("SELECT id FROM booths WHERE id = ? AND organization_id = ? AND status = 'ACTIVE' FOR UPDATE", [input.boothId, org(c)], conn))[0];
        if (!booth)
            throw (0, errors_1.notFound)();
        const voterId = input.voterId?.toUpperCase() ?? null;
        const houseCode = input.houseCode.toUpperCase();
        if (voterId) {
            const existing = (await (0, pool_1.query)("SELECT id FROM citizens WHERE voter_id = ?", [voterId], conn))[0];
            if (existing)
                throw (0, errors_1.conflict)("Voter ID already exists");
        }
        let household = (await (0, pool_1.query)("SELECT id, deleted_at AS deletedAt FROM households WHERE booth_id = ? AND house_code = ?", [input.boothId, houseCode], conn))[0];
        if (household?.deletedAt)
            throw (0, errors_1.conflict)("This household is archived and cannot accept new members");
        if (!household) {
            household = { id: require("crypto").randomUUID() };
            await (0, pool_1.exec)("INSERT INTO households (id, organization_id, booth_id, house_code, address_line) VALUES (?,?,?,?,?)", [household.id, org(c), input.boothId, houseCode, input.address ?? null], conn);
        }
        else if (input.address) {
            await (0, pool_1.exec)("UPDATE households SET address_line = COALESCE(address_line, ?) WHERE id = ?", [input.address, household.id], conn);
        }
        await (0, pool_1.exec)(`INSERT INTO citizens (id, household_id, booth_id, full_name, relation, voter_id, life_status, roll_serial, age, gender, polling_station, polling_address)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [id, household.id, input.boothId, input.fullName, input.relation, voterId, input.lifeStatus, input.rollSerial ?? null, input.age ?? null, input.gender, input.pollingStation ?? null, input.pollingAddress ?? null]);
        await (0, pool_1.exec)("UPDATE households SET verification_status = 'IN_VERIFICATION' WHERE id = ?", [household.id], conn);
        return { id, householdId: household.id };
    });
}
async function archiveCitizen(c, id) {
    return (0, pool_1.tx)(async (conn) => {
        const citizen = (await (0, pool_1.query)(`SELECT ci.household_id AS householdId
            FROM citizens ci JOIN booths b ON b.id = ci.booth_id
            WHERE ci.id = ? AND b.organization_id = ? AND ci.deleted_at IS NULL FOR UPDATE`, [id, org(c)], conn))[0];
        if (!citizen)
            throw (0, errors_1.notFound)();
        await (0, pool_1.exec)("UPDATE citizens SET deleted_at = NOW(3) WHERE id = ? AND deleted_at IS NULL", [id], conn);
        const remaining = (await (0, pool_1.query)(`SELECT COUNT(*) AS activeCount,
                SUM((SELECT COUNT(*) FROM verifications v WHERE v.citizen_id = ci.id AND v.result = 'PASSED') < 6) AS openCount
            FROM citizens ci WHERE ci.household_id = ? AND ci.deleted_at IS NULL`, [citizen.householdId], conn))[0];
        const status = Number(remaining.activeCount) === 0 ? "PENDING" : Number(remaining.openCount) === 0 ? "RESOLVED" : "IN_VERIFICATION";
        await (0, pool_1.exec)("UPDATE households SET verification_status = ? WHERE id = ?", [status, citizen.householdId], conn);
        return { id, archived: true };
    });
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
    const rows = await (0, pool_1.query)(`SELECT h.id, h.house_code AS houseCode, h.address_line AS address, h.verification_status AS status, b.code AS boothCode,
            (SELECT COUNT(*) FROM citizens ci WHERE ci.household_id = h.id AND ci.deleted_at IS NULL) AS members
       FROM households h JOIN booths b ON b.id = h.booth_id WHERE ${where.join(" AND ")} ORDER BY h.id LIMIT ${f.limit + 1}`, p);
    return page(rows.map((r) => ({ ...r, members: Number(r.members) })), f.limit);
}
async function deleteHousehold(c, id) {
    const r = await (0, pool_1.exec)("UPDATE households SET deleted_at = NOW(3) WHERE id = ? AND organization_id = ? AND deleted_at IS NULL", [id, org(c)]);
    if (r.affectedRows === 0)
        throw (0, errors_1.notFound)();
    return { id };
}
const listAllAssignments = (c) => (0, pool_1.query)(`SELECT a.id, a.booth_id AS boothId, b.code AS boothCode, a.user_id AS userId, u.full_name AS fullName, a.starts_at AS startsAt
     FROM booth_assignments a JOIN booths b ON b.id = a.booth_id JOIN users u ON u.id = a.user_id
    WHERE b.organization_id = ? AND a.revoked_at IS NULL ORDER BY b.code, u.full_name LIMIT 500`, [org(c)]);
exports.listAllAssignments = listAllAssignments;
const listEvents = (c) => (0, pool_1.query)("SELECT id, kind, title, body, starts_at AS startsAt, status, published_at AS publishedAt FROM events WHERE organization_id = ? ORDER BY created_at DESC LIMIT 100", [org(c)]);
exports.listEvents = listEvents;
async function updateEvent(c, id, i) {
    const r = await (0, pool_1.exec)("UPDATE events SET title = COALESCE(?, title), body = COALESCE(?, body), starts_at = COALESCE(?, starts_at) WHERE id = ? AND organization_id = ? AND status <> 'ARCHIVED'", [i.title ?? null, i.body ?? null, i.startsAt ? new Date(i.startsAt) : null, id, org(c)]);
    if (r.affectedRows === 0)
        throw (0, errors_1.notFound)();
    await (0, publicContent_1.invalidatePublicContent)();
    return { id };
}
async function settings(c) {
    const o = (await (0, pool_1.query)("SELECT name, slug FROM organizations WHERE id = ?", [org(c)]))[0];
    const media = (await (0, pool_1.query)("SELECT login_video_url AS loginVideoUrl, ward_number AS wardNumber, polling_date_text AS pollingDateText, age_reference_date AS ageReferenceDate, publication_date AS publicationDate, slip_title AS slipTitle, slip_banner_path AS slipBannerPath, slip_accent_color AS slipAccentColor, slip_header_banner_path AS slipHeaderBannerPath, slip_template_url AS slipTemplateUrl FROM organization_settings WHERE organization_id = ?", [org(c)]))[0];
    return {
        organization: o,
        loginVideoUrl: media?.loginVideoUrl ?? null,
        slip: {
            wardNumber: media?.wardNumber ?? "79",
            pollingDateText: media?.pollingDateText ?? "01-11-2026, ఆదివారం",
            ageReferenceDate: media?.ageReferenceDate ?? "2026-01-01",
            publicationDate: media?.publicationDate ?? "2026-09-22",
            slipTitle: media?.slipTitle ?? "విజయవాడ నగర పాలక సంస్థ • ఫోటో ఓటర్ల జాబితా 2026",
            bannerPath: media?.slipBannerPath ?? "/slip/banner.png",
            accentColor: media?.slipAccentColor ?? "#1e3a8a",
            headerBannerPath: media?.slipHeaderBannerPath ?? null,
            templateUrl: media?.slipTemplateUrl ?? null,
        },
        security: { accessTokenMinutes: Math.round(env_1.env.ACCESS_TOKEN_TTL_SECONDS / 60), refreshTokenDays: env_1.env.REFRESH_TOKEN_TTL_DAYS, minPasswordLength: 4,
            passwordHashing: "argon2id", cookiesSecure: env_1.env.NODE_ENV === "production", rateLimitStore: redis_1.redis ? "redis" : "memory (single instance only)" },
        limits: { maxImportRows: 50000, exportExpiryHours: 24 },
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
    return { loginVideoUrl };
}
exports.updateLoginVideo = updateLoginVideo;
async function updateSlipSettings(c, input) {
    await (0, pool_1.exec)(`INSERT INTO organization_settings (organization_id, ward_number, polling_date_text, age_reference_date, publication_date, slip_title, slip_banner_path, slip_accent_color, slip_header_banner_path, slip_template_url, updated_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE ward_number = VALUES(ward_number), polling_date_text = VALUES(polling_date_text), age_reference_date = VALUES(age_reference_date), publication_date = VALUES(publication_date), slip_title = VALUES(slip_title), slip_banner_path = VALUES(slip_banner_path), slip_accent_color = VALUES(slip_accent_color), slip_header_banner_path = VALUES(slip_header_banner_path), slip_template_url = VALUES(slip_template_url), updated_by = VALUES(updated_by)`,
      [org(c), input.wardNumber ?? null, input.pollingDateText ?? null, input.ageReferenceDate ?? null, input.publicationDate ?? null, input.slipTitle ?? null, input.bannerPath ?? null, input.accentColor ?? null, input.headerBannerPath ?? null, input.templateUrl ?? null, c.user.id]);
    return { updated: true };
}
exports.updateSlipSettings = updateSlipSettings;
async function listDeadPeople(c, f) {
    const where = ["b.organization_id = ?", "ci.deleted_at IS NULL", "ci.life_status = 'DECEASED'"];
    const p = [org(c)];
    if (f.boothId) { where.push("ci.booth_id = ?"); p.push(f.boothId); }
    if (f.search) {
        where.push("(ci.full_name LIKE ? OR ci.voter_id LIKE ? OR h.house_code LIKE ?)");
        const term = esc(f.search) + "%";
        p.push(term, term, term.toUpperCase());
    }
    if (f.frozen === "frozen") where.push("ci.is_frozen = 1");
    if (f.frozen === "unfrozen") where.push("ci.is_frozen = 0");
    const limit = Math.min(Math.max(Number(f.limit) || 50, 1), 200);
    const cursor = f.cursor;
    if (cursor) { where.push("ci.id > ?"); p.push(cursor); }
    const rows = await (0, pool_1.query)(`SELECT ci.id, ci.full_name AS fullName, ci.voter_id AS voterId, ci.age, ci.gender,
            ci.is_frozen AS isFrozen, ci.frozen_at AS frozenAt, ci.frozen_by AS frozenBy,
            h.house_code AS houseCode, b.code AS boothCode, u.full_name AS frozenByName
       FROM citizens ci JOIN households h ON h.id = ci.household_id JOIN booths b ON b.id = ci.booth_id
       LEFT JOIN users u ON u.id = ci.frozen_by
      WHERE ${where.join(" AND ")} ORDER BY ci.id LIMIT ${limit + 1}`, p);
    const more = rows.length > limit;
    const items = (more ? rows.slice(0, limit) : rows).map((r) => ({
        id: r.id, fullName: r.fullName, voterId: (0, households_1.maskVoter)(r.voterId),
        age: r.age, gender: r.gender, houseCode: r.houseCode, boothCode: r.boothCode,
        isFrozen: !!r.isFrozen, frozenAt: r.frozenAt, frozenBy: r.frozenBy, frozenByName: r.frozenByName,
    }));
    return { items, nextCursor: more ? items[items.length - 1].id : null };
}
async function freezeDeadPerson(c, id) {
    const row = (await (0, pool_1.query)(`SELECT ci.id, ci.life_status AS lifeStatus, b.organization_id AS orgId
       FROM citizens ci JOIN booths b ON b.id = ci.booth_id WHERE ci.id = ? AND ci.deleted_at IS NULL`, [id]))[0];
    if (!row || row.orgId !== org(c)) throw (0, errors_1.notFound)();
    if (row.lifeStatus !== "DECEASED") throw (0, errors_1.conflict)("Only deceased citizens can be frozen");
    await (0, pool_1.exec)(`UPDATE citizens SET is_frozen = 1, frozen_at = NOW(), frozen_by = ? WHERE id = ?`, [c.user.id, id]);
    return { id, frozen: true };
}
async function unfreezeDeadPerson(c, id) {
    const row = (await (0, pool_1.query)(`SELECT ci.id, b.organization_id AS orgId FROM citizens ci JOIN booths b ON b.id = ci.booth_id WHERE ci.id = ? AND ci.deleted_at IS NULL`, [id]))[0];
    if (!row || row.orgId !== org(c)) throw (0, errors_1.notFound)();
    await (0, pool_1.exec)(`UPDATE citizens SET is_frozen = 0, frozen_at = NULL, frozen_by = NULL WHERE id = ?`, [id]);
    return { id, frozen: false };
}
async function listDFlagPeople(c, f) {
    const where = ["b.organization_id = ?", "ci.deleted_at IS NULL", "ci.d_flag = 1"];
    const p = [org(c)];
    if (f.boothId) { where.push("ci.booth_id = ?"); p.push(f.boothId); }
    if (f.completedBy) { where.push("ci.d_completed_by = ?"); p.push(f.completedBy); }
    if (f.search) {
        where.push("(ci.full_name LIKE ? OR ci.voter_id LIKE ? OR h.house_code LIKE ?)");
        const term = esc(f.search) + "%";
        p.push(term, term, term.toUpperCase());
    }
    if (f.frozen === "frozen") where.push("ci.is_frozen = 1");
    if (f.frozen === "unfrozen") where.push("ci.is_frozen = 0");
    const limit = Math.min(Math.max(Number(f.limit) || 50, 1), 200);
    const cursor = f.cursor;
    if (cursor) { where.push("ci.id > ?"); p.push(cursor); }
    const rows = await (0, pool_1.query)(`SELECT ci.id, ci.full_name AS fullName, ci.voter_id AS voterId, ci.age, ci.gender, ci.life_status AS lifeStatus,
            ci.is_frozen AS isFrozen, ci.frozen_at AS frozenAt, ci.frozen_by AS frozenBy,
            ci.d_completed_by AS completedBy, ci.d_completed_at AS completedAt,
            h.house_code AS houseCode, b.code AS boothCode, u.full_name AS frozenByName, cu.full_name AS completedByName
       FROM citizens ci JOIN households h ON h.id = ci.household_id JOIN booths b ON b.id = ci.booth_id
       LEFT JOIN users u ON u.id = ci.frozen_by
       LEFT JOIN users cu ON cu.id = ci.d_completed_by
      WHERE ${where.join(" AND ")} ORDER BY ci.id LIMIT ${limit + 1}`, p);
    const more = rows.length > limit;
    const items = (more ? rows.slice(0, limit) : rows).map((r) => ({
        id: r.id, fullName: r.fullName, voterId: (0, households_1.maskVoter)(r.voterId),
        age: r.age, gender: r.gender, lifeStatus: r.lifeStatus, houseCode: r.houseCode, boothCode: r.boothCode,
        isFrozen: !!r.isFrozen, frozenAt: r.frozenAt, frozenBy: r.frozenBy, frozenByName: r.frozenByName,
        completedBy: r.completedBy, completedAt: r.completedAt, completedByName: r.completedByName,
    }));
    return { items, nextCursor: more ? items[items.length - 1].id : null };
}
async function freezeDFlagPerson(c, id) {
    const row = (await (0, pool_1.query)(`SELECT ci.id, ci.d_flag AS dFlag, b.organization_id AS orgId
       FROM citizens ci JOIN booths b ON b.id = ci.booth_id WHERE ci.id = ? AND ci.deleted_at IS NULL`, [id]))[0];
    if (!row || row.orgId !== org(c)) throw (0, errors_1.notFound)();
    if (!row.dFlag) throw (0, errors_1.conflict)("Only D-completed citizens can be frozen");
    await (0, pool_1.exec)(`UPDATE citizens SET is_frozen = 1, frozen_at = NOW(), frozen_by = ? WHERE id = ?`, [c.user.id, id]);
    return { id, frozen: true };
}
async function unfreezeDFlagPerson(c, id) {
    const row = (await (0, pool_1.query)(`SELECT ci.id, b.organization_id AS orgId FROM citizens ci JOIN booths b ON b.id = ci.booth_id WHERE ci.id = ? AND ci.deleted_at IS NULL`, [id]))[0];
    if (!row || row.orgId !== org(c)) throw (0, errors_1.notFound)();
    await (0, pool_1.exec)(`UPDATE citizens SET is_frozen = 0, frozen_at = NULL, frozen_by = NULL WHERE id = ?`, [id]);
    return { id, frozen: false };
}
async function listVerificationsForBooths(c) {
    if (c.user.boothIds.length === 0)
        return [];
    return (0, pool_1.query)(`SELECT v.id, v.step, v.result, v.created_at AS createdAt, h.house_code AS houseCode, ci.full_name AS citizenName, u.full_name AS verifier
       FROM verifications v JOIN households h ON h.id = v.household_id JOIN citizens ci ON ci.id = v.citizen_id JOIN users u ON u.id = v.verifier_id
      WHERE v.booth_id IN (${(0, pool_1.placeholders)(c.user.boothIds.length)}) ORDER BY v.created_at DESC LIMIT 100`, c.user.boothIds);
}
