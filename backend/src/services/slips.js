"use strict";
const pool_1 = require("../db/pool");
const errors_1 = require("../errors");
const org = (c) => c.user.organizationId;
async function getSlipSettings(organizationId) {
    const media = (await (0, pool_1.query)("SELECT ward_number AS wardNumber, polling_date_text AS pollingDateText, age_reference_date AS ageReferenceDate, publication_date AS publicationDate, slip_title AS slipTitle, slip_banner_path AS bannerPath, slip_accent_color AS accentColor, slip_header_banner_path AS headerBannerPath, slip_template_url AS templateUrl FROM organization_settings WHERE organization_id = ?", [organizationId]))[0];
    return {
        wardNumber: media?.wardNumber ?? "79",
        pollingDateText: media?.pollingDateText ?? "01-11-2026, ఆదివారం",
        ageReferenceDate: media?.ageReferenceDate ?? "2026-01-01",
        publicationDate: media?.publicationDate ?? "2026-09-22",
        slipTitle: media?.slipTitle ?? "విజయవాడ నగర పాలక సంస్థ • ఫోటో ఓటర్ల జాబితా 2026",
        bannerPath: media?.bannerPath ?? "/slip/banner.png",
        accentColor: media?.accentColor ?? "#1e3a8a",
        headerBannerPath: media?.headerBannerPath ?? null,
        templateUrl: media?.templateUrl ?? null,
    };
}
function assertBoothAccess(c, boothId) {
    if (c.user.role === "ADMIN") return;
    if (c.user.role !== "BOOTH_MEMBER" || !c.user.boothIds.includes(boothId))
        throw (0, errors_1.forbidden)();
}
async function getVoterSlip(c, voterId) {
    const row = (await (0, pool_1.query)(`SELECT ci.id, ci.full_name AS voterName, ci.father_or_husband_name AS fatherName, ci.age, ci.gender, ci.roll_serial AS serialNo, ci.voter_id AS voterId, ci.polling_station AS pollingStation, ci.polling_address AS pollingAddress,
            h.house_code AS doorNo, b.id AS boothId, b.code AS boothNumber, b.organization_id AS organizationId
       FROM citizens ci JOIN households h ON h.id = ci.household_id JOIN booths b ON b.id = ci.booth_id
      WHERE ci.id = ? AND ci.deleted_at IS NULL AND h.deleted_at IS NULL AND b.status = 'ACTIVE'`, [voterId]))[0];
    if (!row || row.organizationId !== c.user.organizationId)
        throw (0, errors_1.notFound)();
    assertBoothAccess(c, row.boothId);
    const settings = await getSlipSettings(c.user.organizationId);
    return { ...row, settings };
}
async function listSlipBatch(c, f) {
    const where = ["b.organization_id = ?", "h.deleted_at IS NULL", "ci.deleted_at IS NULL", "b.status = 'ACTIVE'"];
    const params = [c.user.organizationId];
    if (f.boothId) {
        where.push("ci.booth_id = ?");
        params.push(f.boothId);
        assertBoothAccess(c, f.boothId);
    }
    if (f.pollingStation) {
        where.push("ci.polling_station = ?");
        params.push(f.pollingStation);
    }
    if (f.doorFrom) {
        where.push("h.house_code >= ?");
        params.push(f.doorFrom);
    }
    if (f.doorTo) {
        where.push("h.house_code <= ?");
        params.push(f.doorTo);
    }
    const limit = Math.min(f.pageSize || 200, 200);
    const offset = ((f.page || 1) - 1) * limit;
    const rows = await (0, pool_1.query)(`SELECT ci.id, ci.full_name AS voterName, ci.father_or_husband_name AS fatherName, ci.age, ci.gender, ci.roll_serial AS serialNo, ci.voter_id AS voterId, ci.polling_station AS pollingStation, ci.polling_address AS pollingAddress,
            h.house_code AS doorNo, b.code AS boothNumber
       FROM citizens ci JOIN households h ON h.id = ci.household_id JOIN booths b ON b.id = ci.booth_id
      WHERE ${where.join(" AND ")} ORDER BY ci.roll_serial IS NULL, ci.roll_serial, ci.full_name LIMIT ${limit} OFFSET ${offset}`, params);
    const settings = await getSlipSettings(c.user.organizationId);
    return { items: rows, pageSize: limit, page: f.page || 1, settings };
}
async function logBatchPrint(c, f, count) {
    const id = require("crypto").randomUUID();
    await (0, pool_1.exec)(`INSERT INTO slip_print_log (id, organization_id, user_id, booth_id, polling_station, door_from, door_to, voter_count) VALUES (?,?,?,?,?,?,?,?)`,
        [id, c.user.organizationId, c.user.id, f.boothId ?? null, f.pollingStation ?? null, f.doorFrom ?? null, f.doorTo ?? null, count]);
    return id;
}
module.exports = { getVoterSlip, listSlipBatch, logBatchPrint };