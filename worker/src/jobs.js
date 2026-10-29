"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processImports = processImports;
exports.processExports = processExports;
exports.maintenance = maintenance;
exports.processWhatsAppCampaigns = processWhatsAppCampaigns;
const crypto_1 = require("crypto");
const db_1 = require("./db");
const BATCH = 3000, PAGE = 2000, MAX_EXPORT_ROWS = 200_000;
const FORMULA = /^[=+\-@\t\r]/;
const cell = (v) => { let s = v == null ? "" : String(v); if (FORMULA.test(s))
    s = "'" + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const mask = (v) => (v ? `****${v.slice(-4)}` : "");
const importFailureMessage = (e) => e?.code === "ER_DUP_ENTRY"
    ? "A record conflicted with data saved after preview. Some rows may already be saved; delete this import to permanently remove them before retrying."
    : "Import could not be completed. Some rows may already be saved; delete this import to permanently remove them before retrying.";
const exportFailureMessage = (e) => e?.message === "Export too large; filter by booth"
    ? "Export is too large. Filter by booth and try again."
    : "Export could not be generated. Try again or contact support.";
const safeErrorCode = (e) => typeof e?.code === "string" && /^[A-Z0-9_]{1,40}$/i.test(e.code) ? e.code : "UNKNOWN";
const waRecipient = (value) => {
    const config = db_1.config;
    const raw = String(value ?? "").trim();
    if (!raw || raw.length > 32 || !/^\+?[\d\s()-]+$/.test(raw)) return null;
    let digits = raw.replace(/[+\s()-]/g, "");
    if (raw.startsWith("+")) return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
    if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
    const cc = config.whatsappDefaultCountryCode;
    if (digits.startsWith(cc) && digits.length > 10 && digits.length <= 15) return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
    const intl = `${cc}${digits}`;
    return /^[1-9]\d{7,14}$/.test(intl) ? intl : null;
};
async function updateWhatsAppJob(jobId) {
    const counts = (await db_1.pool.execute(`SELECT
        SUM(status = 'ACCEPTED') AS acceptedCount,
        SUM(status = 'FAILED') AS failedCount,
        SUM(status = 'SKIPPED') AS skippedCount,
        SUM(status IN ('PENDING','PROCESSING')) AS openCount
      FROM whatsapp_campaign_recipients WHERE job_id = ?`, [jobId]))[0][0];
    const accepted = Number(counts.acceptedCount ?? 0);
    const failed = Number(counts.failedCount ?? 0);
    const skipped = Number(counts.skippedCount ?? 0);
    const open = Number(counts.openCount ?? 0);
    const status = open ? "PROCESSING" : failed ? (accepted || skipped ? "COMPLETED_WITH_ERRORS" : "FAILED") : "COMPLETED";
    await db_1.pool.execute(`UPDATE whatsapp_campaign_jobs SET accepted_count = ?, failed_count = ?, skipped_count = invalid_phone_count + ?, status = ?,
        finished_at = IF(? = 0, COALESCE(finished_at, NOW(3)), NULL) WHERE id = ?`, [accepted, failed, skipped, status, open, jobId]);
}
/** Sends approved templates only. A stale PROCESSING recipient is failed as delivery-unknown, never retried blindly. */
async function processWhatsAppCampaigns() {
    const cfg = db_1.config;
    if (!cfg.whatsappAccessToken || !cfg.whatsappPhoneNumberId || !cfg.whatsappApiVersion) return 0;
    const [staleJobs] = await db_1.pool.execute(`SELECT DISTINCT job_id AS jobId FROM whatsapp_campaign_recipients
      WHERE status = 'PROCESSING' AND locked_at < DATE_SUB(NOW(3), INTERVAL 10 MINUTE)`);
    await db_1.pool.execute(`UPDATE whatsapp_campaign_recipients SET status = 'FAILED', error_code = 'WORKER_TIMEOUT_UNKNOWN', locked_by = NULL, locked_at = NULL
      WHERE status = 'PROCESSING' AND locked_at < DATE_SUB(NOW(3), INTERVAL 10 MINUTE)`);
    for (const stale of staleJobs) await updateWhatsAppJob(stale.jobId);
    const [claim] = await db_1.pool.execute(`UPDATE whatsapp_campaign_recipients r
      JOIN whatsapp_campaign_jobs j ON j.id = r.job_id
      SET r.status = 'PROCESSING', r.locked_by = ?, r.locked_at = NOW(3), r.attempts = r.attempts + 1,
          j.status = 'PROCESSING'
      WHERE r.status = 'PENDING' AND r.next_attempt_at <= NOW(3) AND j.status IN ('PENDING','PROCESSING')
      ORDER BY r.created_at LIMIT 1`, [db_1.WORKER_ID]);
    if (!claim.affectedRows) return 0;
      const [rows] = await db_1.pool.execute(`SELECT r.id, r.job_id AS jobId, r.phone_contact_id AS phoneContactId, r.recipient_phone AS recipientPhone, r.attempts,
        j.organization_id AS organizationId,
        j.template_name AS templateName, j.template_language AS language, j.template_parameters AS parameters
      FROM whatsapp_campaign_recipients r JOIN whatsapp_campaign_jobs j ON j.id = r.job_id
      WHERE r.status = 'PROCESSING' AND r.locked_by = ? ORDER BY r.locked_at LIMIT 1`, [db_1.WORKER_ID]);
    const recipient = rows[0];
    if (!recipient) return 1;
    let nextStatus = "FAILED", errorCode = null, providerMessageId = null;
    try {
        const [contacts] = await db_1.pool.execute(`SELECT pc.phone FROM import_phone_contacts pc
          JOIN import_jobs ij ON ij.id = pc.import_job_id AND ij.organization_id = pc.organization_id
          WHERE pc.id = ? AND pc.organization_id = ? AND ij.status = 'COMMITTED' AND ij.deleted_at IS NULL`, [recipient.phoneContactId, recipient.organizationId]);
        if (!contacts[0] || waRecipient(contacts[0].phone) !== recipient.recipientPhone) {
            nextStatus = "SKIPPED";
            errorCode = "CONTACT_CHANGED_OR_WITHDRAWN";
        }
        else {
            const parameters = typeof recipient.parameters === "string" ? JSON.parse(recipient.parameters) : recipient.parameters;
            const template = { name: recipient.templateName, language: { code: recipient.language } };
            if (Array.isArray(parameters) && parameters.length) template.components = [{ type: "body", parameters: parameters.map((value) => ({ type: "text", text: String(value) })) }];
            const response = await fetch(`https://graph.facebook.com/${cfg.whatsappApiVersion}/${cfg.whatsappPhoneNumberId}/messages`, {
                method: "POST",
                headers: { Authorization: `Bearer ${cfg.whatsappAccessToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: recipient.recipientPhone, type: "template", template }),
                signal: AbortSignal.timeout(15_000),
            });
            const payload = await response.json().catch(() => ({}));
            if (response.ok) {
                nextStatus = "ACCEPTED";
                providerMessageId = payload?.messages?.[0]?.id ?? null;
            }
            else if (response.status === 429 && recipient.attempts < 3) {
                await db_1.pool.execute(`UPDATE whatsapp_campaign_recipients SET status = 'PENDING', error_code = 'PROVIDER_RATE_LIMIT', locked_by = NULL, locked_at = NULL,
                    next_attempt_at = DATE_ADD(NOW(3), INTERVAL 30 SECOND) WHERE id = ? AND locked_by = ?`, [recipient.id, db_1.WORKER_ID]);
                await updateWhatsAppJob(recipient.jobId);
                return 1;
            }
            else errorCode = `PROVIDER_${response.status}_${String(payload?.error?.code ?? "ERROR").slice(0, 20)}`;
        }
    }
    catch (e) {
        errorCode = e?.name === "TimeoutError" || e?.name === "AbortError" ? "DELIVERY_UNKNOWN_TIMEOUT" : "PROVIDER_UNAVAILABLE";
    }
    await db_1.pool.execute(`UPDATE whatsapp_campaign_recipients SET status = ?, error_code = ?, provider_message_id = ?, locked_by = NULL, locked_at = NULL
      WHERE id = ? AND locked_by = ?`, [nextStatus, errorCode, providerMessageId, recipient.id, db_1.WORKER_ID]);
    await updateWhatsAppJob(recipient.jobId);
    return 1;
}
/** IMPORT_CITIZENS: claims one QUEUED job (or resumes a stale one), commits in atomic batches with progress tracking. */
async function processImports() {
    await db_1.pool.execute(`UPDATE import_jobs SET status = 'FAILED', last_error = 'Import stopped before roster tracking was enabled', locked_by = NULL
      WHERE status = 'COMMITTING' AND data_tracked = 0 AND locked_at < DATE_SUB(NOW(3), INTERVAL 10 MINUTE)`);
    const [claim] = await db_1.pool.execute(`UPDATE import_jobs SET status = 'COMMITTING', data_tracked = 1, locked_by = ?, locked_at = NOW(3)
      WHERE status = 'QUEUED' OR (status = 'COMMITTING' AND data_tracked = 1 AND locked_at < DATE_SUB(NOW(3), INTERVAL 10 MINUTE))
      ORDER BY created_at LIMIT 1`, [db_1.WORKER_ID]);
    if (!claim.affectedRows)
        return 0;
    const [jobs] = await db_1.pool.execute("SELECT id, organization_id, created_by, payload, processed_rows FROM import_jobs WHERE locked_by = ? AND status = 'COMMITTING'", [db_1.WORKER_ID]);
    for (const job of jobs) {
        try {
            const payload = JSON.parse(job.payload);
            const rows = Array.isArray(payload) ? payload : (payload.records ?? []);
            const phoneContacts = Array.isArray(payload) ? [] : (payload.phoneContacts ?? []);
            for (let offset = 0; offset < phoneContacts.length; offset += 500) {
                const batch = phoneContacts.slice(offset, offset + 500);
                const conn = await db_1.pool.getConnection();
                try {
                    await conn.beginTransaction();
                    await conn.execute(`INSERT IGNORE INTO import_phone_contacts (id, import_job_id, organization_id, phone)
                        VALUES ${batch.map(() => "(?,?,?,?)").join(",")}`,
                    batch.flatMap((contact) => [(0, crypto_1.randomUUID)(), job.id, job.organization_id, contact.phone]));
                    await conn.commit();
                } catch (e) {
                    await conn.rollback().catch(() => undefined);
                    throw e;
                } finally { conn.release(); }
            }
            // CSV booth codes that are not configured yet become active booth records
            // at commit time. Admins can then assign booth members from the portal.
            const codes = [...new Set(rows.map((r) => r.boothCode).filter(Boolean))];
            const [existingBooths] = await db_1.pool.execute("SELECT id, code, status FROM booths WHERE organization_id = ?", [job.organization_id]);
            const existingCodes = new Set(existingBooths.map((b) => String(b.code).toUpperCase()));
            const inactiveCodes = new Set(existingBooths.filter((b) => b.status !== "ACTIVE").map((b) => String(b.code).toUpperCase()));
            if (rows.some((r) => inactiveCodes.has(String(r.boothCode).toUpperCase())))
                throw new Error("Import references an inactive booth; activate it in the admin portal and re-import");
            const missingCodes = codes.filter((code) => !existingCodes.has(String(code).toUpperCase()));
            for (let offset = 0; offset < missingCodes.length; offset += 5000) {
                const boothBatch = missingCodes.slice(offset, offset + 5000);
                await db_1.pool.execute(
                    `INSERT IGNORE INTO booths (id, organization_id, code, name, source_import_job_id) VALUES ${boothBatch.map(() => "(?,?,?,?,?)").join(",")}`,
                    boothBatch.flatMap((code) => [(0, crypto_1.randomUUID)(), job.organization_id, code, `Booth ${String(code).slice(0, 194)}`, job.id])
                );
            }
            const [b] = await db_1.pool.execute("SELECT id, code FROM booths WHERE organization_id = ? AND status = 'ACTIVE'", [job.organization_id]);
            const boothIds = new Map(b.map((x) => [String(x.code).toUpperCase(), x.id]));
            for (const row of rows) {
                row.boothId ??= boothIds.get(String(row.boothCode).toUpperCase());
            }
            const allowedIds = new Set(boothIds.values());
            if (rows.some((r) => !r.boothId || !allowedIds.has(r.boothId)
                || (r.boothCode && boothIds.get(String(r.boothCode).toUpperCase()) !== r.boothId)))
                throw new Error("Import references a booth outside the organisation or inactive");
            let done = job.processed_rows;
            while (done < rows.length) {
                const slice = rows.slice(done, done + BATCH);
                const conn = await db_1.pool.getConnection();
                try {
                    await conn.beginTransaction();
                    const houseMap = new Map();
                    for (const row of slice) {
                        const key = `${row.boothId}|${row.houseCode}`;
                        const current = houseMap.get(key);
                        if (!current || (!current.addressLine && row.addressLine))
                            houseMap.set(key, row);
                    }
                    const houses = [...houseMap.values()];
                    // Imports fill a missing address but don't overwrite a pre-existing one;
                    // the source marker lets import deletion remove this value later.
                    await conn.execute(`INSERT INTO households (id, organization_id, booth_id, house_code, address_line, source_import_job_id, address_source_import_job_id) VALUES ${houses.map(() => "(?,?,?,?,?,?,?)").join(",")} ON DUPLICATE KEY UPDATE
                        address_source_import_job_id = IF(address_line IS NULL AND VALUES(address_line) IS NOT NULL, VALUES(address_source_import_job_id), address_source_import_job_id),
                        address_line = COALESCE(address_line, VALUES(address_line))`, houses.flatMap((r) => [(0, crypto_1.randomUUID)(), job.organization_id, r.boothId, r.houseCode, r.addressLine ?? null, job.id, r.addressLine ? job.id : null]));
                    const [hid] = await conn.execute(`SELECT id, booth_id, house_code FROM households WHERE deleted_at IS NULL AND (booth_id, house_code) IN (${houses.map(() => "(?,?)").join(",")})`, houses.flatMap((r) => [r.boothId, r.houseCode]));
                    const map = new Map(hid.map((h) => [`${h.booth_id}|${h.house_code}`, h.id]));
                    const people = slice.filter((r) => map.has(`${r.boothId}|${r.houseCode}`));
                    if (people.length)
                        await conn.execute(`INSERT INTO citizens (id, household_id, booth_id, full_name, father_or_husband_name, relation, voter_id, life_status, phone, roll_serial, age, gender, d2d_verified, not_here, address_changed, new_address, visit_notes, polling_station, polling_address, d_flag, source_import_job_id) VALUES ${people.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",")}`, people.flatMap((r) => [(0, crypto_1.randomUUID)(), map.get(`${r.boothId}|${r.houseCode}`), r.boothId, r.fullName, r.fatherOrHusbandName ?? null, r.relation, r.voterId, r.lifeStatus, r.phone ?? null, r.rollSerial ?? null, r.age ?? null, r.gender ?? "UNKNOWN", r.verificationDone ? 1 : 0, r.notHere ? 1 : 0, r.addressChanged ? 1 : 0, r.newAddress ?? null, r.visitNotes ?? null, r.pollingStation ?? null, r.pollingAddress ?? null, r.dFlag ? 1 : 0, job.id]));
                    await conn.execute(`UPDATE households SET verification_status = 'IN_VERIFICATION'
                        WHERE (booth_id, house_code) IN (${houses.map(() => "(?,?)").join(",")})`, houses.flatMap((r) => [r.boothId, r.houseCode]));
                    done += slice.length;
                    await conn.execute("UPDATE import_jobs SET processed_rows = ?, locked_at = NOW(3) WHERE id = ?", [done, job.id]); // atomic with the batch
                    await conn.commit();
                }
                catch (e) {
                    await conn.rollback().catch(() => undefined);
                    throw e;
                }
                finally {
                    conn.release();
                }
            }
            await db_1.pool.execute("UPDATE import_jobs SET status = 'COMMITTED', result = ?, payload = NULL, locked_by = NULL WHERE id = ?", [JSON.stringify({ rowsProcessed: rows.length, phoneContacts: phoneContacts.length }), job.id]);
            db_1.log.info({ jobId: job.id, rows: rows.length }, "import committed");
        }
        catch (e) {
            const message = importFailureMessage(e);
            await db_1.pool.execute("UPDATE import_jobs SET status = 'FAILED', last_error = ?, payload = NULL, locked_by = NULL WHERE id = ?", [message, job.id]);
            db_1.log.error({ jobId: job.id, code: safeErrorCode(e) }, "import failed");
        }
    }
    return jobs.length;
}
const ROSTER_SQL = `SELECT ci.id, b.code AS booth_code, h.house_code, h.address_line AS address, ci.roll_serial, ci.full_name, ci.father_or_husband_name, ci.relation, ci.voter_id, ci.age, ci.gender, ci.life_status,
            ci.d2d_verified AS d2d_visit_done, ci.not_here, ci.address_changed, ci.new_address, ci.visit_notes, ci.polling_station, ci.polling_address,
            COALESCE(vp.passed_steps, 0) AS verification_steps, h.verification_status AS household_status
            FROM citizens ci JOIN households h ON h.id = ci.household_id JOIN booths b ON b.id = ci.booth_id
            LEFT JOIN (SELECT citizen_id, COUNT(*) AS passed_steps FROM verifications WHERE result = 'PASSED' GROUP BY citizen_id) vp ON vp.citizen_id = ci.id
           WHERE b.organization_id = ? AND h.deleted_at IS NULL AND ci.deleted_at IS NULL`;
const VERIFICATION_COLS = ["booth_code", "house_code", "address", "roll_serial", "full_name", "father_or_husband_name", "relation", "voter_id", "age", "gender", "life_status", "d2d_visit_done", "not_here", "address_changed", "new_address", "visit_notes", "polling_station", "polling_address", "verification_steps", "household_status"];
const D2D_EXPORT = { headers: ["SN", "SERIAL NO", "DOOR NO", "ADDRESS", "NAME", "FATHER / HUSBAND NAME", "VOTER ID", "GENDER", "BOOTH NO", "DEAD", "NOT HERE", "VERIFICATION DONE", "ADDRESS CHANGED", "NEW ADDRESS", "ADDITIONAL NOTES", "POLLING STATION", "POLLING ADDRESS"],
    cols: ["sn", "serial_no", "door_no", "address", "name", "father_or_husband_name", "voter_id", "gender", "booth_no", "dead", "not_here", "d2d_visit_done", "address_changed", "new_address", "visit_notes", "polling_station", "polling_address"],
    sql: ROSTER_SQL, booth: "ci.booth_id" };
const EXPORTS = {
    CITIZENS: D2D_EXPORT,
    SHIFTED_CITIZENS: { ...D2D_EXPORT, sql: `${ROSTER_SQL} AND ci.address_changed = 1` },
    DECEASED_CITIZENS: { ...D2D_EXPORT, sql: `${ROSTER_SQL} AND ci.life_status = 'DECEASED'` },
    PENDING_D2D: { ...D2D_EXPORT, sql: `${ROSTER_SQL} AND ci.d2d_verified = 0` },
    HOUSEHOLDS: { cols: ["booth_code", "house_code", "status"],
        sql: `SELECT h.id, b.code AS booth_code, h.house_code, h.verification_status AS status
            FROM households h JOIN booths b ON b.id = h.booth_id WHERE b.organization_id = ? AND h.deleted_at IS NULL`, booth: "h.booth_id" },
    PENDING_VERIFICATION: { cols: VERIFICATION_COLS, sql: `${ROSTER_SQL} AND COALESCE(vp.passed_steps, 0) = 0`, booth: "ci.booth_id" },
    IN_PROGRESS_VERIFICATION: { cols: VERIFICATION_COLS, sql: `${ROSTER_SQL} AND COALESCE(vp.passed_steps, 0) BETWEEN 1 AND 5`, booth: "ci.booth_id" },
    VERIFIED_CITIZENS: { cols: VERIFICATION_COLS, sql: `${ROSTER_SQL} AND COALESCE(vp.passed_steps, 0) = 6`, booth: "ci.booth_id" },
};
/** EXPORT_DATA: keyset-paginated so memory stays bounded; sensitive IDs masked; formula-safe CSV. */
async function processExports() {
    const [claim] = await db_1.pool.execute("UPDATE export_jobs SET status = 'PROCESSING', locked_by = ?, locked_at = NOW(3) WHERE status = 'PENDING' ORDER BY created_at LIMIT 1", [db_1.WORKER_ID]);
    if (!claim.affectedRows)
        return 0;
    const [jobs] = await db_1.pool.execute("SELECT id, organization_id, created_by, kind, booth_id FROM export_jobs WHERE locked_by = ? AND status = 'PROCESSING'", [db_1.WORKER_ID]);
    for (const job of jobs) {
        try {
            const def = EXPORTS[job.kind];
            if (!def)
                throw new Error("unknown export kind");
            const lines = [(def.headers ?? def.cols).join(",")];
            let last = "", n = 0;
            const alias = def.sql.includes("FROM citizens ci") ? "ci" : "h";
            for (;;) {
                const params = [job.organization_id];
                let extra = "";
                if (job.booth_id) {
                    extra += ` AND ${def.booth} = ?`;
                    params.push(job.booth_id);
                }
                if (last) {
                    extra += ` AND ${alias}.id > ?`;
                    params.push(last);
                }
                const [rows] = await db_1.pool.execute(`${def.sql}${extra} ORDER BY ${alias}.id LIMIT ${PAGE}`, params);
                if (!rows.length)
                    break;
                for (const r of rows) {
                    lines.push(def.cols.map((c) => {
                        const value = c === "sn" ? n + 1
                            : c === "serial_no" ? r.roll_serial
                            : c === "door_no" ? r.house_code
                            : c === "name" ? r.full_name
                            : c === "booth_no" ? r.booth_code
                            : c === "dead" ? Number(r.life_status === "DECEASED")
                            : r[c];
                        return cell(c === "voter_id" ? mask(value) : value instanceof Date ? value.toISOString() : value);
                    }).join(","));
                    n++;
                }
                last = rows[rows.length - 1].id;
                if (n > MAX_EXPORT_ROWS)
                    throw new Error("Export too large; filter by booth");
                if (rows.length < PAGE)
                    break;
            }
            await db_1.pool.execute("UPDATE export_jobs SET status = 'READY', content = ?, row_count = ?, expires_at = DATE_ADD(NOW(3), INTERVAL 24 HOUR), locked_by = NULL WHERE id = ? AND status = 'PROCESSING' AND locked_by = ?", [lines.join("\n"), n, job.id, db_1.WORKER_ID]);
        }
        catch (e) {
            const message = exportFailureMessage(e);
            await db_1.pool.execute("UPDATE export_jobs SET status = 'FAILED', last_error = ?, locked_by = NULL WHERE id = ? AND status = 'PROCESSING' AND locked_by = ?", [message, job.id, db_1.WORKER_ID]);
            db_1.log.error({ jobId: job.id, code: safeErrorCode(e) }, "export failed");
        }
    }
    return jobs.length;
}
/** CLEAN_EXPIRED_SESSIONS / CLEAN_EXPIRED_EXPORTS + recovery of stuck jobs. */
async function maintenance() {
    await db_1.pool.execute("DELETE FROM sessions WHERE expires_at < DATE_SUB(NOW(3), INTERVAL 1 DAY) OR revoked_at < DATE_SUB(NOW(3), INTERVAL 7 DAY)");
    await db_1.pool.execute("UPDATE export_jobs SET status = 'EXPIRED', content = NULL WHERE status = 'READY' AND expires_at < NOW(3)");
    await db_1.pool.execute("UPDATE export_jobs SET status = 'PENDING', locked_by = NULL WHERE status = 'PROCESSING' AND locked_at < DATE_SUB(NOW(3), INTERVAL 10 MINUTE)");
    await db_1.pool.execute("UPDATE notification_outbox SET status = 'PENDING', locked_by = NULL WHERE status = 'PROCESSING' AND locked_at < DATE_SUB(NOW(3), INTERVAL 5 MINUTE)");
    await db_1.pool.execute("DELETE FROM whatsapp_campaign_recipients WHERE created_at < DATE_SUB(NOW(3), INTERVAL 30 DAY) AND status IN ('ACCEPTED','FAILED','SKIPPED')");
    await db_1.pool.execute(`UPDATE whatsapp_campaign_jobs SET template_parameters = JSON_ARRAY()
        WHERE status IN ('COMPLETED','COMPLETED_WITH_ERRORS','FAILED') AND finished_at < DATE_SUB(NOW(3), INTERVAL 30 DAY)`);
    const orphanedImportBooths = `SELECT b.id FROM booths b
        JOIN import_jobs owner ON owner.id = b.source_import_job_id AND owner.deleted_at IS NOT NULL
        WHERE NOT EXISTS (SELECT 1 FROM households h WHERE h.booth_id = b.id)
          AND NOT EXISTS (SELECT 1 FROM import_jobs pending WHERE pending.organization_id = b.organization_id AND pending.status IN ('QUEUED','COMMITTING'))`;
    await db_1.pool.execute(`DELETE FROM verifications WHERE booth_id IN (${orphanedImportBooths})`);
    await db_1.pool.execute(`DELETE FROM booth_assignments WHERE booth_id IN (${orphanedImportBooths})`);
    await db_1.pool.execute(`DELETE b FROM booths b
        JOIN import_jobs owner ON owner.id = b.source_import_job_id AND owner.deleted_at IS NOT NULL
        WHERE NOT EXISTS (SELECT 1 FROM households h WHERE h.booth_id = b.id)
          AND NOT EXISTS (SELECT 1 FROM import_jobs pending WHERE pending.organization_id = b.organization_id AND pending.status IN ('QUEUED','COMMITTING'))`);
}
