"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listExports = exports.listImportJobs = void 0;
exports.createImportJob = createImportJob;
exports.getImportJob = getImportJob;
exports.confirmImport = confirmImport;
exports.createExport = createExport;
exports.getExport = getExport;
exports.downloadExport = downloadExport;
exports.deleteExport = deleteExport;
exports.normalizeHeader = normalizeHeader;
const crypto_1 = require("crypto");
const pool_1 = require("../db/pool");
const errors_1 = require("../errors");
const csv_1 = require("./csv");
const 

/** 
 * Normalize and validate a phone number for import purposes.
 * Returns the normalized phone string, or undefined if invalid,
 * or null if the phone should be excluded from messaging.
 * Does NOT link the phone to voter IDs - phones are owned by the import.
 */
function normalizePhoneForImport(phone) {
    const normalized = importPhone_1.normalizeImportedPhone(phone);
    if (normalized === undefined) return undefined;  // Malformed
    if (normalized === null) return null;  // Empty
    return normalized;  // Valid
}
const REQUIRED = ["booth_code", "house_code", "full_name"];
const MAX_ROWS = 50_000;
const LIFE = ["ALIVE", "DECEASED", "UNKNOWN"];
const HEADER_ALIASES = {
    booth: "booth_code", booth_n: "booth_code", booth_no: "booth_code", booth_number: "booth_code",
    door_no: "house_code", door_number: "house_code",
    name: "full_name", voter_name: "full_name", serial: "roll_serial", sn: "roll_serial", s_no: "roll_serial", serial_n: "roll_serial",
    serial_no: "roll_serial", serial_number: "roll_serial",
    additional_notes: "visit_notes", shifted: "address_changed",
    no_here: "not_here",
    voter_id_no: "voter_id", voter_id_number: "voter_id",
    phone_number: "phone", phone_no: "phone", mobile: "phone", mobile_no: "phone", mobile_number: "phone", contact_number: "phone", whatsapp_number: "phone",
    father_s_name_husband_s_name: "father_or_husband_name",
    father_name_husband_name: "father_or_husband_name",
    father_name_or_husband_name: "father_or_husband_name",
};
function normalizeHeader(value) {
    const key = value.trim().toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return HEADER_ALIASES[key] ?? key;
}
const parseBoolean = (value) => {
    const normalized = value.trim().toLowerCase();
    if (["", "0", "false", "no", "n", "కాదు"].includes(normalized))
        return false;
    if (["1", "true", "yes", "y", "అవును"].includes(normalized))
        return true;
    return null;
};
/** Steps 1-5 of the import flow: validate -> parse -> validate rows -> store preview. Nothing is committed here. */
async function createImportJob(c, csv) {
    let rows;
    try {
        rows = (0, csv_1.parseCsv)(csv.replace(/^\uFEFF/, ""));
    }
    catch {
        throw new errors_1.AppError(422, "INVALID_CSV", "CSV contains invalid quoting");
    }
    if (rows.length < 2)
        throw new errors_1.AppError(422, "EMPTY_FILE", "File has no data rows");
    if (rows.length - 1 > MAX_ROWS)
        throw new errors_1.AppError(422, "TOO_MANY_ROWS", `Max ${MAX_ROWS} rows per import`);
    const header = (rows[0] ?? []).map(normalizeHeader);
    const headerIndex = new Map();
    header.forEach((name, index) => { if (!headerIndex.has(name)) headerIndex.set(name, index); });
    const missing = REQUIRED.filter((r) => !headerIndex.has(r));
    if (missing.length)
        throw new errors_1.AppError(422, "MISSING_COLUMNS", `Missing columns: ${missing.join(", ")}`);
    const boothRows = await (0, pool_1.query)("SELECT id, code, status FROM booths WHERE organization_id = ?", [c.user.organizationId]);
    const activeBooths = new Map(boothRows.filter((b) => b.status === "ACTIVE").map((b) => [String(b.code).toUpperCase(), b.id]));
    const knownBoothCodes = new Set(boothRows.map((b) => String(b.code).toUpperCase()));
    const errors = [];
    let errorCount = 0;
    const bad = (line, message) => { errorCount++; if (errors.length < 200)
        errors.push({ line, message }); };
    const valid = [];
    const phoneContacts = new Map();
    let invalidPhoneRows = 0;
    const seen = new Set();
    const householdAddresses = new Map();
    let duplicateRows = 0;
    for (let i = 1; i < rows.length; i++) {
        const r = rows[i] ?? [];
        const line = i + 1;
        const get = (n) => { const k = headerIndex.get(n); return k === undefined ? "" : (r[k] ?? "").trim(); };
        const phoneInput = get("phone");
        const phone = (0, importPhone_1.normalizeImportedPhone)(phoneInput);
        if (phone === undefined) invalidPhoneRows++;
        else if (phone) phoneContacts.set((/\D/g, ""), phone);
        const f = {
            booth: get("booth_code"),
            house: get("house_code"),
            address: get("address") || get("address_line"),
            serial: get("roll_serial") || get("serial_number"),
            name: get("full_name"),
            fatherOrHusbandName: get("father_or_husband_name"),
            rel: get("relation"),
            voter: get("voter_id"),
            age: get("age"),
            gender: (get("gender") || "UNKNOWN").trim().toUpperCase(),
            dead: get("dead"),
            life: get("life_status").toUpperCase(),
            verificationDone: get("verification_done"),
            notHere: get("not_here"),
            addressChanged: get("address_changed"),
            newAddress: get("new_address"),
            visitNotes: get("visit_notes"),
        };
        // CSV/XLSX values are parsed as strings and never evaluated. Formula-leading
        // text is stored literally; CSV exports escape it before spreadsheet use.
        const boothCode = f.booth.normalize("NFKC").toUpperCase();
        if (!boothCode || boothCode.length > 255 || /[\u0000-\u001F\u007F]/.test(boothCode)) {
            bad(line, "Invalid booth_code");
            continue;
        }
        const boothId = activeBooths.get(boothCode);
        if (!boothId && knownBoothCodes.has(boothCode)) {
            bad(line, "Unknown or inactive booth_code");
            continue;
        }
        if (!f.house || f.house.length > 255 || /[\u0000-\u001F\u007F]/.test(f.house)) {
            bad(line, "Invalid house_code");
            continue;
        }
        if (f.name.length < 1 || f.name.length > 200) {
            bad(line, "Invalid full_name");
            continue;
        }
        if (f.fatherOrHusbandName.length > 200) {
            bad(line, "father_or_husband_name must be at most 200 characters");
            continue;
        }
        if (!f.rel)
            f.rel = "RESIDENT";
        const rel = f.rel.toUpperCase();
        if (!/^\p{L}[\p{L}\p{M} _-]{0,31}$/u.test(rel)) {
            bad(line, "Invalid relation");
            continue;
        }
        if (f.address.length > 255) {
            bad(line, "address must be at most 255 characters");
            continue;
        }
        const dead = f.dead ? parseBoolean(f.dead) : null;
        if (f.dead && dead === null) {
            bad(line, "dead must be 0/1, true/false, or yes/no");
            continue;
        }
        const lifeStatus = f.life || (dead === null ? "UNKNOWN" : dead ? "DECEASED" : "ALIVE");
        if (!LIFE.includes(lifeStatus)) {
            bad(line, "Invalid life_status");
            continue;
        }
        const notHere = parseBoolean(f.notHere);
        const addressChanged = parseBoolean(f.addressChanged);
        const verificationDone = parseBoolean(f.verificationDone);
        if (notHere === null || addressChanged === null || verificationDone === null) {
            bad(line, "verification_done, not_here and address_changed must be 0/1, true/false, or yes/no");
            continue;
        }
        if (f.newAddress.length > 255 || f.visitNotes.length > 1000) {
            bad(line, "new_address must be at most 255 characters and visit_notes at most 1000 characters");
            continue;
        }
        if (f.serial && ([...f.serial].length > 32 || /[\u0000-\u001F\u007F]/.test(f.serial))) {
            bad(line, "Invalid roll_serial: use at most 32 printable characters");
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
        if (f.voter) {
            if ([...f.voter].length > 32 || /[\u0000-\u001F\u007F]/.test(f.voter)) {
                bad(line, "Invalid voter_id: use at most 32 printable characters");
                continue;
            }
            const voterKey = f.voter.toUpperCase();
            if (seen.has(voterKey)) {
                duplicateRows++;
                continue;
            }
        }
        const householdKey = `${boothId}|${f.house.toUpperCase()}`;
        const previousAddress = householdAddresses.get(householdKey);
        if (f.address && previousAddress && f.address !== previousAddress) {
            bad(line, "Rows for the same household must use the same address");
            continue;
        }
        if (f.address)
            householdAddresses.set(householdKey, f.address);
        if (f.voter)
            seen.add(f.voter.toUpperCase());
        valid.push({
            boothId: boothId ?? null,
            boothCode,
            houseCode: f.house.toUpperCase(),
            addressLine: f.address || null,
            rollSerial: f.serial || null,
            fullName: f.name,
            fatherOrHusbandName: f.fatherOrHusbandName || null,
            relation: rel,
            voterId: f.voter || null,
            age,
            gender,
            lifeStatus,
            verificationDone,
            notHere,
            addressChanged,
            newAddress: f.newAddress || null,
            visitNotes: f.visitNotes || null,
            line,
        });
    }
    const ids = [...seen];
    const existing = new Map();
    // Keep each lookup comfortably below MySQL's placeholder/packet limits while
    // avoiding dozens of sequential network round trips for large voter lists.
    const voterLookupBatchSize = 5000;
    for (let i = 0; i < ids.length; i += voterLookupBatchSize) {
        const chunk = ids.slice(i, i + voterLookupBatchSize);
        (await (0, pool_1.query)(`SELECT ci.id, ci.voter_id FROM citizens ci
            JOIN booths b ON b.id = ci.booth_id WHERE b.organization_id = ? AND ci.voter_id IN (${(0, pool_1.placeholders)(chunk.length)})`, [c.user.organizationId, ...chunk]))
            .forEach((r) => existing.set(String(r.voter_id).toUpperCase(), r));
    }
    let existingRows = 0;
    const final = valid.filter((v) => { if (v.voterId && existing.has(v.voterId.toUpperCase())) {
        existingRows++;
        return false;
    } return true; });
    const pendingBoothCodes = [...new Set(final.filter((v) => !v.boothId).map((v) => v.boothCode))].sort();
    const skippedRows = existingRows + duplicateRows;
    const id = (0, crypto_1.randomUUID)();
    const contacts = [...phoneContacts.values()].map((phone) => ({ phone }));
    await (0, pool_1.exec)(`INSERT INTO import_jobs (id, organization_id, created_by, total_rows, valid_rows, error_count, skipped_rows, errors, payload) VALUES (?,?,?,?,?,?,?,?,?)`, [id, c.user.organizationId, c.user.id, rows.length - 1, final.length + contacts.length, errorCount, skippedRows, JSON.stringify(errors), JSON.stringify({ records: final, phoneContacts: contacts })]);
    return {
        id,
        status: "PREVIEW",
        totalRows: rows.length - 1,
        validRows: final.length + contacts.length,
        rosterRows: final.length,
        phoneRows: contacts.length,
        invalidPhoneRows,
        skippedRows,
        errorCount,
        errors: errors.slice(0, 50),
        pendingBoothCodes,
    };
}
const IMPORT_COLS = `id, status, total_rows AS totalRows, valid_rows AS validRows, skipped_rows AS skippedRows, error_count AS errorCount, processed_rows AS processedRows, result, last_error AS lastError, created_at AS createdAt, data_tracked AS dataTracked, (status = 'PREVIEW' OR (status NOT IN ('QUEUED','COMMITTING') AND data_tracked = 1)) AS canDelete`;
async function getImportJob(c, id) {
    const j = (await (0, pool_1.query)(`SELECT ${IMPORT_COLS}, errors FROM import_jobs WHERE id = ? AND organization_id = ? AND deleted_at IS NULL`, [id, c.user.organizationId]))[0];
    if (!j)
        throw (0, errors_1.notFound)();
    if (typeof j.errors === "string")
        j.errors = JSON.parse(j.errors);
    return j;
}
const listImportJobs = (c) => (0, pool_1.query)(`SELECT ${IMPORT_COLS} FROM import_jobs WHERE organization_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 20`, [c.user.organizationId]);
exports.listImportJobs = listImportJobs;
async function deleteImportJob(c, id) {
    return (0, pool_1.tx)(async (conn) => {
        const job = (await (0, pool_1.query)(`SELECT status, data_tracked AS dataTracked FROM import_jobs
            WHERE id = ? AND organization_id = ? AND deleted_at IS NULL FOR UPDATE`, [id, c.user.organizationId], conn))[0];
        if (!job)
            throw (0, errors_1.notFound)();
        if (job.status === "QUEUED" || job.status === "COMMITTING")
            throw (0, errors_1.conflict)("Wait until the import finishes before deleting it");
        const tracked = Number(job.dataTracked) === 1;
        if (job.status !== "PREVIEW" && !tracked)
            throw new errors_1.AppError(409, "IMPORT_NOT_TRACKED", "This older import has no safe record mapping and cannot be deleted here");
        let candidateBoothIds = [];
        let candidateHouseholdIds = [];
        if (tracked) {
            const campaignJobs = (await (0, pool_1.query)(`SELECT DISTINCT r.job_id AS jobId
                FROM whatsapp_campaign_recipients r JOIN import_phone_contacts pc ON pc.id = r.phone_contact_id
                WHERE pc.import_job_id = ? AND pc.organization_id = ?`, [id, c.user.organizationId], conn)).map((row) => row.jobId);
            if (campaignJobs.length) {
                const marks = (0, pool_1.placeholders)(campaignJobs.length);
                await (0, pool_1.exec)(`UPDATE whatsapp_campaign_recipients r
                    JOIN import_phone_contacts pc ON pc.id = r.phone_contact_id
                    SET r.error_code = IF(r.status IN ('PENDING','PROCESSING'), 'SOURCE_IMPORT_DELETED', r.error_code),
                        r.status = IF(r.status IN ('PENDING','PROCESSING'), 'SKIPPED', r.status),
                        r.locked_by = NULL, r.locked_at = NULL,
                        r.recipient_phone = NULL, r.phone_contact_id = NULL
                    WHERE pc.import_job_id = ? AND pc.organization_id = ?`, [id, c.user.organizationId], conn);
                await (0, pool_1.exec)(`UPDATE whatsapp_campaign_jobs j SET
                    accepted_count = (SELECT COUNT(*) FROM whatsapp_campaign_recipients r WHERE r.job_id = j.id AND r.status = 'ACCEPTED'),
                    failed_count = (SELECT COUNT(*) FROM whatsapp_campaign_recipients r WHERE r.job_id = j.id AND r.status = 'FAILED'),
                    skipped_count = j.invalid_phone_count + (SELECT COUNT(*) FROM whatsapp_campaign_recipients r WHERE r.job_id = j.id AND r.status = 'SKIPPED'),
                    status = CASE
                      WHEN EXISTS (SELECT 1 FROM whatsapp_campaign_recipients r WHERE r.job_id = j.id AND r.status IN ('PENDING','PROCESSING')) THEN 'PROCESSING'
                      WHEN EXISTS (SELECT 1 FROM whatsapp_campaign_recipients r WHERE r.job_id = j.id AND r.status = 'FAILED') THEN 'COMPLETED_WITH_ERRORS'
                      ELSE 'COMPLETED' END,
                    finished_at = IF(EXISTS (SELECT 1 FROM whatsapp_campaign_recipients r WHERE r.job_id = j.id AND r.status IN ('PENDING','PROCESSING')), NULL, COALESCE(j.finished_at, NOW(3)))
                    WHERE j.id IN (${marks}) AND j.organization_id = ?`, [...campaignJobs, c.user.organizationId], conn);
            }
            await (0, pool_1.exec)("DELETE FROM import_phone_contacts WHERE import_job_id = ? AND organization_id = ?", [id, c.user.organizationId], conn);
            candidateBoothIds = (await (0, pool_1.query)(`SELECT b.id FROM booths b
                WHERE b.organization_id = ?
                  AND (b.source_import_job_id = ? OR EXISTS (
                    SELECT 1 FROM households h WHERE h.booth_id = b.id
                      AND (h.source_import_job_id = ? OR h.address_source_import_job_id = ?)
                  )) FOR UPDATE`, [c.user.organizationId, id, id], conn)).map((b) => b.id);
            candidateHouseholdIds = (await (0, pool_1.query)(`SELECT h.id FROM households h
                WHERE h.organization_id = ?
                  AND (h.source_import_job_id = ? OR h.address_source_import_job_id = ? OR EXISTS (
                    SELECT 1 FROM citizens ci WHERE ci.household_id = h.id AND ci.source_import_job_id = ?
                  )) FOR UPDATE`, [c.user.organizationId, id, id, id], conn)).map((h) => h.id);
            await (0, pool_1.exec)(`DELETE FROM verifications
                WHERE citizen_id IN (SELECT id FROM citizens WHERE source_import_job_id = ?)`, [id], conn);
            await (0, pool_1.exec)("DELETE FROM citizens WHERE source_import_job_id = ?", [id], conn);
            await (0, pool_1.exec)(`DELETE FROM households h
                WHERE (h.source_import_job_id = ? OR h.address_source_import_job_id = ?)
                  AND NOT EXISTS (SELECT 1 FROM citizens ci WHERE ci.household_id = h.id)`, [id, id], conn);
            if (candidateHouseholdIds.length) {
                const marks = (0, pool_1.placeholders)(candidateHouseholdIds.length);
                await (0, pool_1.exec)(`UPDATE households h SET
                    address_line = IF(h.address_source_import_job_id = ?, NULL, h.address_line),
                    address_source_import_job_id = IF(h.address_source_import_job_id = ?, NULL, h.address_source_import_job_id),
                    verification_status = CASE
                      WHEN NOT EXISTS (SELECT 1 FROM citizens ci WHERE ci.household_id = h.id AND ci.deleted_at IS NULL) THEN 'PENDING'
                      WHEN EXISTS (
                        SELECT 1 FROM citizens ci WHERE ci.household_id = h.id AND ci.deleted_at IS NULL
                          AND (SELECT COUNT(*) FROM verifications v WHERE v.citizen_id = ci.id AND v.result = 'PASSED') < 6
                      ) THEN 'IN_VERIFICATION'
                      ELSE 'RESOLVED'
                    END
                    WHERE h.id IN (${marks})`, [id, id, ...candidateHouseholdIds], conn);
            }
            if (candidateBoothIds.length) {
                const marks = (0, pool_1.placeholders)(candidateBoothIds.length);
                // Carry legacy booths into the same deferred cleanup pipeline if another
                // import is still running and the booth becomes empty in this transaction.
                await (0, pool_1.exec)(`UPDATE booths b SET source_import_job_id = ?
                    WHERE b.organization_id = ? AND b.id IN (${marks})
                      AND NOT EXISTS (SELECT 1 FROM households h WHERE h.booth_id = b.id)`,
                [id, c.user.organizationId, ...candidateBoothIds], conn);
            }
        }
        await (0, pool_1.exec)(`UPDATE import_jobs SET deleted_at = NOW(3), payload = NULL, errors = NULL,
                result = NULL, last_error = NULL, total_rows = 0, valid_rows = 0,
                skipped_rows = 0, error_count = 0, processed_rows = 0
            WHERE id = ? AND organization_id = ? AND deleted_at IS NULL`, [id, c.user.organizationId], conn);
        if (tracked) {
            // Previously generated exports are snapshots and may still contain this roster.
            // Expire them atomically; a worker finishing concurrently must not republish one.
            await (0, pool_1.exec)(`UPDATE export_jobs SET status = 'EXPIRED', content = NULL,
                    row_count = 0, expires_at = NOW(3), last_error = NULL, locked_by = NULL, locked_at = NULL
                WHERE organization_id = ? AND status IN ('PENDING','PROCESSING','READY','FAILED')`, [c.user.organizationId], conn);
            if (candidateBoothIds.length) {
                const marks = (0, pool_1.placeholders)(candidateBoothIds.length);
                const emptyBoothIds = (await (0, pool_1.query)(`SELECT b.id FROM booths b
                    WHERE b.id IN (${marks})
                      AND NOT EXISTS (SELECT 1 FROM households h WHERE h.booth_id = b.id)
                      AND NOT EXISTS (SELECT 1 FROM import_jobs pending WHERE pending.organization_id = b.organization_id AND pending.status IN ('QUEUED','COMMITTING'))
                    FOR UPDATE`, candidateBoothIds, conn)).map((b) => b.id);
                if (emptyBoothIds.length) {
                    const emptyMarks = (0, pool_1.placeholders)(emptyBoothIds.length);
                    await (0, pool_1.exec)(`DELETE FROM verifications WHERE booth_id IN (${emptyMarks})`, emptyBoothIds, conn);
                    await (0, pool_1.exec)(`DELETE FROM booth_assignments WHERE booth_id IN (${emptyMarks})`, emptyBoothIds, conn);
                    await (0, pool_1.exec)(`DELETE FROM booths WHERE organization_id = ? AND id IN (${emptyMarks})`, [c.user.organizationId, ...emptyBoothIds], conn);
                }
            }
        }
        return { id, deleted: true };
    });
}
exports.deleteImportJob = deleteImportJob;
/** Admin confirmation -> queued for the background worker (atomic PREVIEW -> QUEUED, cannot be confirmed twice). */
async function confirmImport(c, id) {
    const r = await (0, pool_1.exec)("UPDATE import_jobs SET status = 'QUEUED' WHERE id = ? AND organization_id = ? AND deleted_at IS NULL AND status = 'PREVIEW' AND valid_rows > 0", [id, c.user.organizationId]);
    if (r.affectedRows === 0) {
        await getImportJob(c, id);
        throw (0, errors_1.conflict)("Import is not in a confirmable state");
    }
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
    return { kind: String(j.kind).toLowerCase(), content: String(j.content) };
}
async function deleteExport(c, id) {
    return (0, pool_1.tx)(async (conn) => {
        const job = (await (0, pool_1.query)("SELECT status, kind FROM export_jobs WHERE id = ? AND organization_id = ? FOR UPDATE", [id, c.user.organizationId], conn))[0];
        if (!job)
            throw (0, errors_1.notFound)();
        if (job.status === "PROCESSING")
            throw (0, errors_1.conflict)("Wait until the export finishes before deleting it");
        await (0, pool_1.exec)("DELETE FROM export_jobs WHERE id = ? AND organization_id = ?", [id, c.user.organizationId], conn);
        return { id, deleted: true };
    });
}
