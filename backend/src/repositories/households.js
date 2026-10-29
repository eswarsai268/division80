"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskVoter = void 0;
exports.listBoothsForUser = listBoothsForUser;
exports.listHouseholdsForUser = listHouseholdsForUser;
exports.listOfflineRosterForUser = listOfflineRosterForUser;
exports.getOfflineRosterRevisionForUser = getOfflineRosterRevisionForUser;
exports.getHouseholdForUser = getHouseholdForUser;
exports.listCitizensForUser = listCitizensForUser;
exports.updateVisitForUser = updateVisitForUser;
const pool_1 = require("../db/pool");
const errors_1 = require("../errors");
const env_1 = require("../config/env");
const importPhone_1 = require("../utils/importPhone");
const boothAssignments_1 = require("./boothAssignments");
const maskVoter = (v) => (v ? `****${v.slice(-4)}` : null);
exports.maskVoter = maskVoter;
const escLike = (s) => s.replace(/[\\%_]/g, (m) => "\\" + m);
function editDistance(a, b) {
    const d = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) d[i][0] = i;
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
}
function nameMatchScore(name, search) {
    const nameTokens = String(name ?? "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
    const queryTokens = String(search ?? "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
    if (!nameTokens.length || !queryTokens.length) return null;
    const normalizedName = nameTokens.join("");
    const normalizedQuery = queryTokens.join("");
    if (normalizedName === normalizedQuery) return 0;
    if (normalizedName.startsWith(normalizedQuery)) return 1;
    if (normalizedName.includes(normalizedQuery)) return 2;
    for (let i = 0; i < queryTokens.length - 1; i++) {
        if (normalizedName.includes(queryTokens[i] + queryTokens[i + 1])) return 1.5 + (queryTokens.length - 2) * 10;
    }
    let total = 0, matched = 0;
    for (const token of queryTokens) {
        let best = Infinity;
        for (const word of nameTokens) {
            if (word.includes(token) || token.includes(word)) best = Math.min(best, 2 + Math.abs(word.length - token.length) / Math.max(word.length, token.length));
            else if (Math.min(word.length, token.length) >= 4) {
                const distance = editDistance(word, token);
                if (distance <= Math.max(1, Math.ceil(Math.min(word.length, token.length) * 0.3))) best = Math.min(best, 4 + distance);
            }
        }
        if (Number.isFinite(best)) { matched++; total += best; }
    }
    return matched >= Math.min(2, queryTokens.length) ? total / matched + (queryTokens.length - matched) * 10 : null;
}
async function listBoothsForUser(u) {
    if (u.role !== "BOOTH_MEMBER")
        throw (0, errors_1.forbidden)();
    return (0, pool_1.query)(`SELECT b.id, b.code, b.name FROM booths b
        WHERE b.organization_id = ? AND b.status = 'ACTIVE'
          AND EXISTS (
              SELECT 1 FROM households h
              JOIN citizens c ON c.household_id = h.id AND c.booth_id = h.booth_id
              WHERE h.booth_id = b.id AND h.organization_id = b.organization_id
                AND h.deleted_at IS NULL AND c.deleted_at IS NULL
          )
        ORDER BY b.code`, [u.organizationId]);
}
/** Booth members may read active household rosters across their organization. */
async function listHouseholdsForUser(u, f) {
    if (u.role !== "BOOTH_MEMBER")
        throw (0, errors_1.forbidden)();
    const where = ["h.organization_id = ?", "b.organization_id = ?", "b.status = 'ACTIVE'", "h.deleted_at IS NULL"];
    const params = [u.organizationId, u.organizationId];
    if (f.boothId) {
        where.push("h.booth_id = ?");
        params.push(f.boothId);
    }
    if (f.search) {
        const raw = f.search.trim().toUpperCase();
        const search = `%${escLike(raw)}%`;
        const voterQuery = escLike(raw.replace(/[\s-]/g, ""));
        const voterLike = voterQuery ? `%${voterQuery}%` : "%__NO_VOTER_MATCH__%";
        const voterNearby = voterQuery && /\d/.test(raw) ? `%${[...voterQuery].join("%")}%` : voterLike;
        const nameTerms = [...new Set(raw.split(/[^A-Z0-9]+/).filter(Boolean))];
        const nameCombinations = nameTerms.length >= 3
            ? nameTerms.flatMap((term, index) => nameTerms.slice(index + 1).map((other) => [term, other]))
            : nameTerms.map((term) => [term]);
        const nameConditions = nameCombinations.map((terms) => `(${terms.map(() => "UPPER(c.full_name) LIKE ?").join(" AND ")})`).join(" OR ");
        const nameTermParams = nameCombinations.flatMap((terms) => terms.map((term) => `%${escLike(term)}%`));
        where.push(`(UPPER(h.house_code) LIKE ? OR EXISTS (
            SELECT 1 FROM citizens c WHERE c.household_id = h.id AND c.booth_id = h.booth_id AND c.deleted_at IS NULL
              AND (UPPER(c.full_name) LIKE ? OR (${nameConditions})
                   OR UPPER(REPLACE(REPLACE(COALESCE(c.voter_id, ''), '-', ''), ' ', '')) LIKE ?
                   OR UPPER(REPLACE(REPLACE(COALESCE(c.voter_id, ''), '-', ''), ' ', '')) LIKE ?
                   OR UPPER(COALESCE(c.roll_serial, '')) LIKE ? OR UPPER(COALESCE(c.father_or_husband_name, '')) LIKE ?)
        ))`);
        params.push(search, search, ...nameTermParams, voterLike, voterNearby, search, search);
    }
    if (f.status) {
        if (f.status === "UNVERIFIED") {
            where.push(`EXISTS (SELECT 1 FROM citizens c WHERE c.household_id = h.id AND c.booth_id = h.booth_id
                AND c.deleted_at IS NULL AND c.d2d_verified = 0)`);
        }
        else if (f.status === "RESOLVED") {
            where.push(`EXISTS (SELECT 1 FROM citizens c WHERE c.household_id = h.id AND c.booth_id = h.booth_id AND c.deleted_at IS NULL AND c.d2d_verified = 1)`);
        }
        else {
            where.push("h.verification_status = ?");
            params.push(f.status);
        }
    }
    let totals = { totalHouseholds: 0, totalPeople: 0 };
    if (!f.cursor) {
        const [row] = await (0, pool_1.query)(`SELECT COUNT(DISTINCT h.id) AS totalHouseholds, COUNT(c.id) AS totalPeople
            FROM households h JOIN booths b ON b.id = h.booth_id
            LEFT JOIN citizens c ON c.household_id = h.id AND c.booth_id = h.booth_id AND c.deleted_at IS NULL
            WHERE ${where.join(" AND ")}`, params);
        totals = { totalHouseholds: Number(row.totalHouseholds), totalPeople: Number(row.totalPeople) };
    }
    if (f.cursor) {
        const cursor = (await (0, pool_1.query)(`SELECT b.code AS boothCode, h.house_code AS houseCode
            FROM households h JOIN booths b ON b.id = h.booth_id
            WHERE h.id = ? AND h.organization_id = ? AND b.organization_id = ? AND b.status = 'ACTIVE'
              AND h.deleted_at IS NULL ${f.boothId ? "AND h.booth_id = ?" : ""}`,
        [f.cursor, u.organizationId, u.organizationId, ...(f.boothId ? [f.boothId] : [])]))[0];
        if (!cursor)
            return { items: [], nextCursor: null };
        where.push(`(b.code > ? OR (b.code = ? AND h.house_code > ?)
            OR (b.code = ? AND h.house_code = ? AND h.id > ?))`);
        params.push(cursor.boothCode, cursor.boothCode, cursor.houseCode,
            cursor.boothCode, cursor.houseCode, f.cursor);
    }
    const effectiveLimit = f.limit;
    const rows = await (0, pool_1.query)(`SELECT h.id, h.booth_id AS boothId, b.code AS boothCode, b.name AS boothName,
            h.house_code AS houseCode, h.verification_status AS status,
            (SELECT COUNT(*) FROM citizens c WHERE c.household_id = h.id AND c.booth_id = h.booth_id AND c.deleted_at IS NULL) AS citizenCount,
            (SELECT COUNT(*) FROM citizens c WHERE c.household_id = h.id AND c.booth_id = h.booth_id AND c.deleted_at IS NULL AND c.d2d_verified = 1) AS visitedCount,
            (SELECT COUNT(*) FROM citizens c WHERE c.household_id = h.id AND c.booth_id = h.booth_id AND c.deleted_at IS NULL AND (SELECT COUNT(*) FROM verifications v WHERE v.citizen_id = c.id AND v.result = 'PASSED') = 6) AS verifiedCount
       FROM households h JOIN booths b ON b.id = h.booth_id AND b.status = 'ACTIVE'
      WHERE ${where.join(" AND ")} ORDER BY b.code, h.house_code, h.id LIMIT ${effectiveLimit + 1}`, params);
    const more = rows.length > effectiveLimit;
    const items = rows.length > effectiveLimit ? rows.slice(0, effectiveLimit) : rows;
    if (f.search && items.length) {
        const houseIds = items.map((h) => h.id);
        const raw = f.search.trim().toUpperCase();
        const search = `%${escLike(raw)}%`;
        const voterQuery = escLike(raw.replace(/[\s-]/g, ""));
        const voterLike = voterQuery ? `%${voterQuery}%` : "%__NO_VOTER_MATCH__%";
        const voterNearby = voterQuery && /\d/.test(raw) ? `%${[...voterQuery].join("%")}%` : voterLike;
        const nameTerms = [...new Set(raw.split(/[^A-Z0-9]+/).filter(Boolean))];
        const nameCombinations = nameTerms.length >= 3
            ? nameTerms.flatMap((term, index) => nameTerms.slice(index + 1).map((other) => [term, other]))
            : nameTerms.map((term) => [term]);
        const nameConditions = nameCombinations.map((terms) => `(${terms.map(() => "UPPER(c.full_name) LIKE ?").join(" AND ")})`).join(" OR ");
        const nameTermParams = nameCombinations.flatMap((terms) => terms.map((term) => `%${escLike(term)}%`));
        const people = await (0, pool_1.query)(`SELECT c.household_id AS householdId, c.id, c.full_name AS fullName,
                c.father_or_husband_name AS fatherOrHusbandName, c.voter_id AS voterId, c.roll_serial AS rollSerial
            FROM citizens c WHERE c.household_id IN (${(0, pool_1.placeholders)(houseIds.length)}) AND c.deleted_at IS NULL
              AND (UPPER(c.full_name) LIKE ? OR (${nameConditions})
                OR UPPER(REPLACE(REPLACE(COALESCE(c.voter_id, ''), '-', ''), ' ', '')) LIKE ?
                OR UPPER(REPLACE(REPLACE(COALESCE(c.voter_id, ''), '-', ''), ' ', '')) LIKE ?
                OR UPPER(COALESCE(c.roll_serial, '')) LIKE ? OR UPPER(COALESCE(c.father_or_husband_name, '')) LIKE ?)
            ORDER BY c.full_name`, [...houseIds, search, ...nameTermParams, voterLike, voterNearby, search, search]);
        const matched = people.map((person) => {
            const voter = String(person.voterId ?? "").toUpperCase().replace(/[\s-]/g, "");
            const voterHit = voterQuery && (voter.includes(voterQuery) || (/\d/.test(raw) && [...voterQuery].every((ch, i) => voter.indexOf(ch, i ? voter.indexOf(voterQuery[i - 1]) + 1 : 0) >= 0)));
            const nameScore = nameMatchScore(person.fullName, raw);
            const serialHit = String(person.rollSerial ?? "").toUpperCase().includes(raw);
            const relativeHit = String(person.fatherOrHusbandName ?? "").toUpperCase().includes(raw);
            const score = voterHit ? 0 : nameScore ?? (serialHit || relativeHit ? 8 : null);
            return score === null ? null : { ...person, score };
        }).filter(Boolean).sort((a, b) => a.score - b.score || String(a.fullName).localeCompare(String(b.fullName)));        const byHouse = new Map();
        for (const person of matched) {
            const list = byHouse.get(person.householdId) ?? [];
            list.push({ id: person.id, fullName: person.fullName, fatherOrHusbandName: person.fatherOrHusbandName, score: person.score });
            byHouse.set(person.householdId, list);
        }
        for (const house of items) {
            house.matchingCitizens = byHouse.get(house.id) ?? [];
            const houseCode = String(house.houseCode).toUpperCase().replace(/[\s-]/g, "");
            const query = raw.replace(/[\s-]/g, "");
            house.searchRank = houseCode === query ? -1 : house.matchingCitizens.length ? house.matchingCitizens[0].score : 9;
        }
    }
    return { items, nextCursor: more ? items[items.length - 1].id : null, ...totals };
}
async function listOfflineRosterForUser(u, f) {
    if (u.role !== "BOOTH_MEMBER")
        throw (0, errors_1.forbidden)();
    const page = await listHouseholdsForUser(u, f);
    if (!page.items.length)
        return { ...page, items: [] };
    const ids = page.items.map((house) => house.id);
    const marks = (0, pool_1.placeholders)(ids.length);
    const [houses, citizens] = await Promise.all([
        (0, pool_1.query)(`SELECT id, address_line AS address FROM households WHERE id IN (${marks}) AND organization_id = ?`, [...ids, u.organizationId]),
        (0, pool_1.query)(`SELECT c.id, c.household_id AS householdId, c.booth_id AS boothId,
                c.full_name AS fullName, c.father_or_husband_name AS fatherOrHusbandName,
                c.relation, c.voter_id AS voterId, c.life_status AS lifeStatus, c.phone,
                c.roll_serial AS rollSerial, c.age, c.gender, c.d2d_verified AS verificationDone, c.polling_station AS pollingStation, c.polling_address AS pollingAddress,
                c.not_here AS notHere, c.address_changed AS addressChanged,
                c.new_address AS newAddress, c.visit_notes AS visitNotes
            FROM citizens c JOIN households h ON h.id = c.household_id AND h.booth_id = c.booth_id
            JOIN booths b ON b.id = h.booth_id AND b.organization_id = h.organization_id AND b.status = 'ACTIVE'
            WHERE c.household_id IN (${marks}) AND c.deleted_at IS NULL AND h.deleted_at IS NULL
              AND h.organization_id = ?
            ORDER BY c.household_id, c.relation, c.full_name`, [...ids, u.organizationId]),
    ]);
    const addressByHousehold = new Map(houses.map((house) => [house.id, house.address]));
    const citizensByHousehold = new Map();
    for (const citizen of citizens) {
        const list = citizensByHousehold.get(citizen.householdId) ?? [];
        const { phone, ...citizenRecord } = citizen;
        list.push({
            ...citizenRecord,
            voterId: u.boothIds.includes(citizen.boothId) ? citizen.voterId : (0, exports.maskVoter)(citizen.voterId),
            whatsappPhone: u.boothIds.includes(citizen.boothId)
                ? (0, importPhone_1.toWhatsAppRecipient)(phone, env_1.env.WHATSAPP_DEFAULT_COUNTRY_CODE)
                : null,
        });
        citizensByHousehold.set(citizen.householdId, list);
    }
    return {
        ...page,
        items: page.items.map((house) => ({
            ...house,
            ownBooth: u.boothIds.includes(house.boothId),
            address: addressByHousehold.get(house.id) ?? null,
            citizens: citizensByHousehold.get(house.id) ?? [],
        })),
    };
}
async function getOfflineRosterRevisionForUser(u) {
    if (u.role !== "BOOTH_MEMBER")
        throw (0, errors_1.forbidden)();
    const rows = await (0, pool_1.query)(`SELECT SHA2(CONCAT_WS('|',
        (SELECT CONCAT(COUNT(*), ':', COALESCE(DATE_FORMAT(MAX(h.updated_at), '%Y%m%d%H%i%s%f'), ''))
           FROM households h WHERE h.organization_id = ?),
        (SELECT CONCAT(COUNT(*), ':', COALESCE(DATE_FORMAT(MAX(c.updated_at), '%Y%m%d%H%i%s%f'), ''))
           FROM citizens c JOIN households h ON h.id = c.household_id WHERE h.organization_id = ?),
        (SELECT CONCAT(COUNT(*), ':', COALESCE(DATE_FORMAT(MAX(b.updated_at), '%Y%m%d%H%i%s%f'), ''))
           FROM booths b WHERE b.organization_id = ?),
        (SELECT CONCAT(COUNT(*), ':', COALESCE(DATE_FORMAT(MAX(COALESCE(a.revoked_at, a.created_at)), '%Y%m%d%H%i%s%f'), ''))
           FROM booth_assignments a JOIN booths b ON b.id = a.booth_id WHERE b.organization_id = ?),
        (SELECT CONCAT(COUNT(*), ':', COALESCE(DATE_FORMAT(MAX(v.created_at), '%Y%m%d%H%i%s%f'), ''))
           FROM verifications v JOIN booths b ON b.id = v.booth_id WHERE b.organization_id = ?),
        (SELECT CONCAT(COUNT(*), ':', COALESCE(DATE_FORMAT(MAX(e.updated_at), '%Y%m%d%H%i%s%f'), ''))
           FROM events e WHERE e.organization_id = ?),
        (SELECT CONCAT(COUNT(*), ':', COALESCE(DATE_FORMAT(MAX(j.updated_at), '%Y%m%d%H%i%s%f'), ''))
           FROM import_jobs j WHERE j.organization_id = ? AND j.deleted_at IS NOT NULL)
    ), 256) AS revision`, Array(7).fill(u.organizationId));
    return { revision: String(rows[0]?.revision ?? "") };
}
/**
 * Booth members may read households in their organization. Full voter IDs and visit writes
 * remain limited to booths in the caller's active assignments. Unauthorized == 404.
 */
async function getHouseholdForUser(u, householdId) {
    if (u.role !== "BOOTH_MEMBER")
        throw (0, errors_1.notFound)();
    const rows = await (0, pool_1.query)(`SELECT h.id, h.booth_id AS boothId, b.code AS boothCode, h.house_code AS houseCode, h.address_line AS address,
            h.verification_status AS status
       FROM households h JOIN booths b ON b.id = h.booth_id AND b.status = 'ACTIVE'
      WHERE h.id = ? AND h.deleted_at IS NULL AND h.organization_id = ? AND b.organization_id = ?`, [householdId, u.organizationId, u.organizationId]);
    if (!rows[0])
        throw (0, errors_1.notFound)();
    return { ...rows[0], ownBooth: u.boothIds.includes(rows[0].boothId) };
}
async function listCitizensForUser(u, householdId) {
    const house = await getHouseholdForUser(u, householdId); // authorisation first
    const rows = await (0, pool_1.query)(`SELECT c.id, c.full_name AS fullName, c.father_or_husband_name AS fatherOrHusbandName, c.relation, c.voter_id AS voterId, c.life_status AS lifeStatus, c.phone,
            c.roll_serial AS rollSerial, c.age, c.gender, c.d2d_verified AS verificationDone, c.polling_station AS pollingStation, c.polling_address AS pollingAddress,
            c.not_here AS notHere, c.address_changed AS addressChanged,
            c.new_address AS newAddress, c.visit_notes AS visitNotes,
            (SELECT COUNT(*) FROM verifications v WHERE v.citizen_id = c.id AND v.result = 'PASSED') AS passedSteps
       FROM citizens c WHERE c.household_id = ? AND c.booth_id = ? AND c.deleted_at IS NULL ORDER BY c.relation, c.full_name`, [householdId, house.boothId]);
    return {
        household: house,
        citizens: rows.map(({ phone, ...r }) => ({
            ...r,
            voterId: house.ownBooth ? r.voterId : (0, exports.maskVoter)(r.voterId),
            whatsappPhone: house.ownBooth
                ? (0, importPhone_1.toWhatsAppRecipient)(phone, env_1.env.WHATSAPP_DEFAULT_COUNTRY_CODE)
                : null,
            passedSteps: Number(r.passedSteps),
        })),
    };
}
async function updateVisitForUser(c, citizenId, input) {
    const u = c.user;
    if (u.role !== "BOOTH_MEMBER" || u.boothIds.length === 0)
        throw (0, errors_1.notFound)();
    return (0, pool_1.tx)(async (conn) => {
        const candidate = (await (0, pool_1.query)(`SELECT booth_id AS boothId FROM citizens
            WHERE id = ? AND deleted_at IS NULL`, [citizenId], conn))[0];
        if (!candidate || !u.boothIds.includes(candidate.boothId))
            throw (0, errors_1.notFound)();
        if (!(await (0, boothAssignments_1.lockActiveBoothAssignment)(conn, u.id, u.organizationId, candidate.boothId)))
            throw (0, errors_1.notFound)();
        const citizen = (await (0, pool_1.query)(`SELECT id FROM citizens
            WHERE id = ? AND booth_id = ? AND deleted_at IS NULL FOR UPDATE`,
        [citizenId, candidate.boothId], conn))[0];
        if (!citizen)
            throw (0, errors_1.notFound)();
        await (0, pool_1.exec)(`UPDATE citizens SET life_status = ?, d2d_verified = ?, not_here = ?, address_changed = ?,
            new_address = ?, visit_notes = ? WHERE id = ? AND deleted_at IS NULL`,
        [input.lifeStatus, input.verificationDone ? 1 : 0, input.notHere ? 1 : 0, input.addressChanged ? 1 : 0,
            input.addressChanged ? input.newAddress || null : null, input.visitNotes || null, citizenId], conn);
        return { id: citizenId };
    });
}
