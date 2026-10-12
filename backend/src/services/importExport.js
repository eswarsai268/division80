"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listExports = exports.listImportJobs = void 0;
exports.createImportJob = createImportJob;
exports.getImportJob = getImportJob;
exports.confirmImport = confirmImport;
exports.createExport = createExport;
exports.getExport = getExport;
exports.downloadExport = downloadExport;
const crypto_1 = require("crypto");
const pool_1 = require("../db/pool");
const errors_1 = require("../errors");
const audit_1 = require("./audit");
const csv_1 = require("./csv");
const REQUIRED = ["booth_code", "house_code", "full_name", "relation"];
const MAX_ROWS = 50_000;
const LIFE = ["ALIVE", "DECEASED", "UNKNOWN"];
/** Steps 1-5 of the import flow: validate -> parse -> validate rows -> store preview. Nothing is committed here. */
async function createImportJob(c, csv) {
    const rows = (0, csv_1.parseCsv)(csv.replace(/^\uFEFF/, ""));
    if (rows.length < 2)
        throw new errors_1.AppError(422, "EMPTY_FILE", "File has no data rows");
    if (rows.length - 1 > MAX_ROWS)
        throw new errors_1.AppError(422, "TOO_MANY_ROWS", `Max ${MAX_ROWS} rows per import`);
    const header = (rows[0] ?? []).map((x) => x.trim().toLowerCase());
    const missing = REQUIRED.filter((r) => !header.includes(r));
    if (missing.length)
        throw new errors_1.AppError(422, "MISSING_COLUMNS", `Missing columns: ${missing.join(", ")}`);
    const booths = new Map((await (0, pool_1.query)("SELECT id, code FROM booths WHERE organization_id = ? AND status = 'ACTIVE'", [c.user.organizationId]))
        .map((b) => [String(b.code).toUpperCase(), b.id]));
    const errors = [];
    let errorCount = 0;
    const bad = (line, message) => { errorCount++; if (errors.length < 200)
        errors.push({ line, message }); };
    const valid = [];
    const seen = new Set();
    const householdAddresses = new Map();
    for (let i = 1; i < rows.length; i++) {
        const r = rows[i] ?? [];
        const line = i + 1;
        const get = (n) => { const k = header.indexOf(n); return k < 0 ? "" : (r[k] ?? "").trim(); };
        const f = {
            booth: get("booth_code"),
            house: get("house_code"),
            address: get("address") || get("address_line"),
            serial: get("roll_serial") || get("serial_number"),
            name: get("full_name"),
            rel: get("relation"),
            voter: get("voter_id").toUpperCase(),
            age: get("age"),
            gender: (get("gender") || "UNKNOWN").trim().toUpperCase(),
            life: (get("life_status") || "UNKNOWN").toUpperCase(),
        };
        if (Object.values(f).some((v) => csv_1.FORMULA.test(v))) {
            bad(line, "Cell starts with a formula character (= + - @)");
            continue;
        }
        const boothId = booths.get(f.booth.toUpperCase());
        if (!boothId) {
            bad(line, "Unknown or inactive booth_code");
            continue;
        }
        if (!/^[A-Za-z0-9][A-Za-z0-9\-/]{0,31}$/.test(f.house)) {
            bad(line, "Invalid house_code");
            continue;
        }
        if (f.name.length < 1 || f.name.length > 200) {
            bad(line, "Invalid full_name");
            continue;
        }
        const rel = f.rel.toUpperCase();
        if (!/^\p{L}[\p{L}\p{M} _-]{0,31}$/u.test(rel)) {
            bad(line, "Invalid relation");
            continue;
        }
        if (f.address.length > 255) {
            bad(line, "address must be at most 255 characters");
            continue;
        }
        if (f.serial && !/^[A-Za-z0-9][A-Za-z0-9/-]{0,31}$/.test(f.serial)) {
            bad(line, "Invalid roll_serial");
            continue;
        }
        const age = f.age ? Number(f.age) : null;
        if (f.age && (!Number.isInteger(age) || age < 0 || age > 130)) {
            bad(line, "age must be a whole number from 0 to 130");
            continue;
        }
        const genderAliases = {
            M: "MALE", MALE: "MALE", "పురుషుడు": "MALE", "పురుష": "MALE",
            F: "FEMALE", FEMALE: "FEMALE", "మహిళ": "FEMALE", "స్త్రీ": "FEMALE",
            OTHER: "OTHER", "ఇతర": "OTHER", UNKNOWN: "UNKNOWN", "తెలియదు": "UNKNOWN",
        };
        const gender = genderAliases[f.gender];
        if (!gender) {
            bad(line, "gender must be MALE, FEMALE, OTHER, or UNKNOWN");
            continue;
        }
        if (!LIFE.includes(f.life)) {
            bad(line, "Invalid life_status");
            continue;
        }
        if (f.voter) {
            if (!/^[A-Z0-9]{6,20}$/.test(f.voter)) {
                bad(line, "Invalid voter_id");
                continue;
            }
            if (seen.has(f.voter)) {
                bad(line, "Duplicate voter_id in file");
                continue;
            }
            seen.add(f.voter);
        }
        const householdKey = `${boothId}|${f.house.toUpperCase()}`;
        const previousAddress = householdAddresses.get(householdKey);
        if (f.address && previousAddress && f.address !== previousAddress) {
            bad(line, "Rows for the same household must use the same address");
            continue;
        }
        if (f.address)
            householdAddresses.set(householdKey, f.address);
        valid.push({
            boothId,
            houseCode: f.house.toUpperCase(),
            addressLine: f.address || null,
            rollSerial: f.serial || null,
            fullName: f.name,
            relation: rel,
            voterId: f.voter || null,
            age,
            gender,
            lifeStatus: f.life,
            line,
        });
    }
    const ids = [...seen];
    const existing = new Set();
    for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        (await (0, pool_1.query)(`SELECT voter_id FROM citizens WHERE voter_id IN (${(0, pool_1.placeholders)(chunk.length)})`, chunk)).forEach((r) => existing.add(String(r.voter_id).toUpperCase()));
    }
    const final = valid.filter((v) => { if (v.voterId && existing.has(v.voterId)) {
        bad(v.line, "voter_id already exists");
        return false;
    } return true; });
    const id = (0, crypto_1.randomUUID)();
    await (0, pool_1.exec)(`INSERT INTO import_jobs (id, organization_id, created_by, total_rows, valid_rows, error_count, errors, payload) VALUES (?,?,?,?,?,?,?,?)`, [id, c.user.organizationId, c.user.id, rows.length - 1, final.length, errorCount, JSON.stringify(errors), JSON.stringify(final)]);
    await (0, audit_1.audit)({ actorId: c.user.id, action: "IMPORT", resourceType: "IMPORT_JOB", resourceId: id, outcome: "SUCCESS", reason: "preview created", requestId: c.requestId });
    return { id, status: "PREVIEW", totalRows: rows.length - 1, validRows: final.length, errorCount, errors: errors.slice(0, 50) };
}
const IMPORT_COLS = `id, status, total_rows AS totalRows, valid_rows AS validRows, error_count AS errorCount, processed_rows AS processedRows, result, last_error AS lastError, created_at AS createdAt`;
async function getImportJob(c, id) {
    const j = (await (0, pool_1.query)(`SELECT ${IMPORT_COLS}, errors FROM import_jobs WHERE id = ? AND organization_id = ?`, [id, c.user.organizationId]))[0];
    if (!j)
        throw (0, errors_1.notFound)();
    if (typeof j.errors === "string")
        j.errors = JSON.parse(j.errors);
    return j;
}
const listImportJobs = (c) => (0, pool_1.query)(`SELECT ${IMPORT_COLS} FROM import_jobs WHERE organization_id = ? ORDER BY created_at DESC LIMIT 20`, [c.user.organizationId]);
exports.listImportJobs = listImportJobs;
/** Admin confirmation -> queued for the background worker (atomic PREVIEW -> QUEUED, cannot be confirmed twice). */
async function confirmImport(c, id) {
    const r = await (0, pool_1.exec)("UPDATE import_jobs SET status = 'QUEUED' WHERE id = ? AND organization_id = ? AND status = 'PREVIEW' AND valid_rows > 0", [id, c.user.organizationId]);
    if (r.affectedRows === 0) {
        await getImportJob(c, id);
        throw (0, errors_1.conflict)("Import is not in a confirmable state");
    }
    await (0, audit_1.audit)({ actorId: c.user.id, action: "IMPORT", resourceType: "IMPORT_JOB", resourceId: id, outcome: "SUCCESS", reason: "confirmed", requestId: c.requestId });
    return { id, status: "QUEUED" };
}
async function createExport(c, i) {
    if (i.boothId) {
        const b = (await (0, pool_1.query)("SELECT id FROM booths WHERE id = ? AND organization_id = ?", [i.boothId, c.user.organizationId]))[0];
        if (!b)
            throw (0, errors_1.notFound)();
    }
    const id = (0, crypto_1.randomUUID)();
    await (0, pool_1.exec)("INSERT INTO export_jobs (id, organization_id, created_by, kind, booth_id) VALUES (?,?,?,?,?)", [id, c.user.organizationId, c.user.id, i.kind, i.boothId ?? null]);
    await (0, audit_1.audit)({ actorId: c.user.id, action: "EXPORT", resourceType: "EXPORT_JOB", resourceId: id, scope: `${i.kind}${i.boothId ? ":booth:" + i.boothId : ":org"}`, outcome: "SUCCESS", reason: "requested", requestId: c.requestId });
    return { id, status: "PENDING" };
}
const EXPORT_COLS = `id, kind, booth_id AS boothId, status, row_count AS rowCount, expires_at AS expiresAt, last_error AS lastError, created_at AS createdAt`;
const listExports = (c) => (0, pool_1.query)(`SELECT ${EXPORT_COLS} FROM export_jobs WHERE organization_id = ? ORDER BY created_at DESC LIMIT 20`, [c.user.organizationId]);
exports.listExports = listExports;
async function getExport(c, id) {
    const j = (await (0, pool_1.query)(`SELECT ${EXPORT_COLS} FROM export_jobs WHERE id = ? AND organization_id = ?`, [id, c.user.organizationId]))[0];
    if (!j)
        throw (0, errors_1.notFound)();
    return j;
}
async function downloadExport(c, id) {
    const j = (await (0, pool_1.query)("SELECT kind, content FROM export_jobs WHERE id = ? AND organization_id = ? AND status = 'READY' AND expires_at > NOW(3)", [id, c.user.organizationId]))[0];
    if (!j || j.content == null)
        throw (0, errors_1.notFound)();
    await (0, audit_1.audit)({ actorId: c.user.id, action: "EXPORT", resourceType: "EXPORT_JOB", resourceId: id, outcome: "SUCCESS", reason: "downloaded", requestId: c.requestId });
    return { kind: String(j.kind).toLowerCase(), content: String(j.content) };
}
