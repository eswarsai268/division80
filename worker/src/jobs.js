"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processImports = processImports;
exports.processExports = processExports;
exports.maintenance = maintenance;
const crypto_1 = require("crypto");
const db_1 = require("./db");
const BATCH = 1000, PAGE = 2000, MAX_EXPORT_ROWS = 200_000;
const FORMULA = /^[=+\-@\t\r]/;
const cell = (v) => { let s = v == null ? "" : String(v); if (FORMULA.test(s))
    s = "'" + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const mask = (v) => (v ? `****${v.slice(-4)}` : "");
const importFailureMessage = (e) => e?.code === "ER_DUP_ENTRY"
    ? "A record conflicted with data saved after preview. Some rows may already be saved; delete this import to archive them before retrying."
    : "Import could not be completed. Some rows may already be saved; delete this import to archive them before retrying.";
const exportFailureMessage = (e) => e?.message === "Export too large; filter by booth"
    ? "Export is too large. Filter by booth and try again."
    : "Export could not be generated. Try again or contact support.";
const safeErrorCode = (e) => typeof e?.code === "string" && /^[A-Z0-9_]{1,40}$/i.test(e.code) ? e.code : "UNKNOWN";
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
            const rows = JSON.parse(job.payload);
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
                    `INSERT IGNORE INTO booths (id, organization_id, code, name) VALUES ${boothBatch.map(() => "(?,?,?,?)").join(",")}`,
                    boothBatch.flatMap((code) => [(0, crypto_1.randomUUID)(), job.organization_id, code, `Booth ${code}`])
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
                    await conn.execute(`INSERT INTO households (id, organization_id, booth_id, house_code, address_line, source_import_job_id) VALUES ${houses.map(() => "(?,?,?,?,?,?)").join(",")} ON DUPLICATE KEY UPDATE address_line = COALESCE(VALUES(address_line), address_line)`, houses.flatMap((r) => [(0, crypto_1.randomUUID)(), job.organization_id, r.boothId, r.houseCode, r.addressLine ?? null, job.id]));
                    const [hid] = await conn.execute(`SELECT id, booth_id, house_code FROM households WHERE deleted_at IS NULL AND (booth_id, house_code) IN (${houses.map(() => "(?,?)").join(",")})`, houses.flatMap((r) => [r.boothId, r.houseCode]));
                    const map = new Map(hid.map((h) => [`${h.booth_id}|${h.house_code}`, h.id]));
                    const people = slice.filter((r) => map.has(`${r.boothId}|${r.houseCode}`));
                    if (people.length)
                        await conn.execute(`INSERT INTO citizens (id, household_id, booth_id, full_name, relation, voter_id, life_status, roll_serial, age, gender, d2d_verified, not_here, address_changed, new_address, visit_notes, source_import_job_id) VALUES ${people.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",")}`, people.flatMap((r) => [(0, crypto_1.randomUUID)(), map.get(`${r.boothId}|${r.houseCode}`), r.boothId, r.fullName, r.relation, r.voterId, r.lifeStatus, r.rollSerial ?? null, r.age ?? null, r.gender ?? "UNKNOWN", r.verificationDone ? 1 : 0, r.notHere ? 1 : 0, r.addressChanged ? 1 : 0, r.newAddress ?? null, r.visitNotes ?? null, job.id]));
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
            await db_1.pool.execute("UPDATE import_jobs SET status = 'COMMITTED', result = ?, payload = NULL, locked_by = NULL WHERE id = ?", [JSON.stringify({ rowsProcessed: rows.length }), job.id]);
            await (0, db_1.audit)(job.created_by, "IMPORT", "IMPORT_JOB", job.id, `committed ${rows.length} rows`);
            db_1.log.info({ jobId: job.id, rows: rows.length }, "import committed");
        }
        catch (e) {
            const message = importFailureMessage(e);
            await db_1.pool.execute("UPDATE import_jobs SET status = 'FAILED', last_error = ?, payload = NULL, locked_by = NULL WHERE id = ?", [message, job.id]);
            await (0, db_1.audit)(job.created_by, "IMPORT", "IMPORT_JOB", job.id, message, "FAILURE");
            db_1.log.error({ jobId: job.id, code: safeErrorCode(e) }, "import failed");
        }
    }
    return jobs.length;
}
const ROSTER_SQL = `SELECT ci.id, b.code AS booth_code, h.house_code, h.address_line AS address, ci.roll_serial, ci.full_name, ci.relation, ci.voter_id, ci.age, ci.gender, ci.life_status,
            ci.d2d_verified AS d2d_visit_done, ci.not_here, ci.address_changed, ci.new_address, ci.visit_notes,
            COALESCE(vp.passed_steps, 0) AS verification_steps, h.verification_status AS household_status
            FROM citizens ci JOIN households h ON h.id = ci.household_id JOIN booths b ON b.id = ci.booth_id
            LEFT JOIN (SELECT citizen_id, COUNT(*) AS passed_steps FROM verifications WHERE result = 'PASSED' GROUP BY citizen_id) vp ON vp.citizen_id = ci.id
           WHERE b.organization_id = ? AND h.deleted_at IS NULL AND ci.deleted_at IS NULL`;
const VERIFICATION_COLS = ["booth_code", "house_code", "address", "roll_serial", "full_name", "relation", "voter_id", "age", "gender", "life_status", "d2d_visit_done", "not_here", "address_changed", "new_address", "visit_notes", "verification_steps", "household_status"];
const D2D_EXPORT = { headers: ["SN", "SERIAL NO", "DOOR NO", "ADDRESS", "NAME", "VOTER ID", "GENDER", "BOOTH NO", "DEAD", "NOT HERE", "VERIFICATION DONE", "ADDRESS CHANGED", "NEW ADDRESS", "ADDITIONAL NOTES"],
    cols: ["sn", "serial_no", "door_no", "address", "name", "voter_id", "gender", "booth_no", "dead", "not_here", "d2d_visit_done", "address_changed", "new_address", "visit_notes"],
    sql: ROSTER_SQL, booth: "ci.booth_id" };
const EXPORTS = {
    CITIZENS: D2D_EXPORT,
    SHIFTED_CITIZENS: { ...D2D_EXPORT, sql: `${ROSTER_SQL} AND ci.address_changed = 1` },
    DECEASED_CITIZENS: { ...D2D_EXPORT, sql: `${ROSTER_SQL} AND ci.life_status = 'DECEASED'` },
    PENDING_D2D: { ...D2D_EXPORT, sql: `${ROSTER_SQL} AND ci.d2d_verified = 0` },
    HOUSEHOLDS: { cols: ["booth_code", "house_code", "status"],
        sql: `SELECT h.id, b.code AS booth_code, h.house_code, h.verification_status AS status
            FROM households h JOIN booths b ON b.id = h.booth_id WHERE b.organization_id = ? AND h.deleted_at IS NULL`, booth: "h.booth_id" },
    COMPLAINTS: { cols: ["category", "status", "title", "created_at"],
        sql: `SELECT c.id, c.category, c.status, c.title, c.created_at FROM complaints c WHERE c.organization_id = ?`, booth: "c.assigned_booth_id" },
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
            for (;;) {
                const params = [job.organization_id];
                let extra = "";
                if (job.booth_id) {
                    extra += ` AND ${def.booth} = ?`;
                    params.push(job.booth_id);
                }
                if (last) {
                    extra += ` AND ${def.sql.includes("FROM citizens ci") ? "ci" : def.sql.includes("FROM households h") ? "h" : "c"}.id > ?`;
                    params.push(last);
                }
                const alias = def.sql.includes("FROM citizens ci") ? "ci" : def.sql.includes("FROM households h") ? "h" : "c";
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
            await db_1.pool.execute("UPDATE export_jobs SET status = 'READY', content = ?, row_count = ?, expires_at = DATE_ADD(NOW(3), INTERVAL 24 HOUR), locked_by = NULL WHERE id = ?", [lines.join("\n"), n, job.id]);
            await (0, db_1.audit)(job.created_by, "EXPORT", "EXPORT_JOB", job.id, `generated ${n} rows`);
        }
        catch (e) {
            const message = exportFailureMessage(e);
            await db_1.pool.execute("UPDATE export_jobs SET status = 'FAILED', last_error = ?, locked_by = NULL WHERE id = ?", [message, job.id]);
            await (0, db_1.audit)(job.created_by, "EXPORT", "EXPORT_JOB", job.id, message, "FAILURE");
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
    await db_1.pool.execute("UPDATE cross_booth_requests SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at < NOW(3)");
}
