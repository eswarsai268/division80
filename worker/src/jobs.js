"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processImports = processImports;
exports.processExports = processExports;
exports.maintenance = maintenance;
const crypto_1 = require("crypto");
const db_1 = require("./db");
const BATCH = 500, PAGE = 2000, MAX_EXPORT_ROWS = 200_000;
const FORMULA = /^[=+\-@\t\r]/;
const cell = (v) => { let s = v == null ? "" : String(v); if (FORMULA.test(s))
    s = "'" + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const mask = (v) => (v ? `****${v.slice(-4)}` : "");
const errMsg = (e) => String(e?.message ?? "error").slice(0, 250);
/** IMPORT_CITIZENS: claims one QUEUED job (or resumes a stale one), commits in atomic batches with progress tracking. */
async function processImports() {
    const [claim] = await db_1.pool.execute(`UPDATE import_jobs SET status = 'COMMITTING', locked_by = ?, locked_at = NOW(3)
      WHERE status = 'QUEUED' OR (status = 'COMMITTING' AND locked_at < DATE_SUB(NOW(3), INTERVAL 10 MINUTE))
      ORDER BY created_at LIMIT 1`, [db_1.WORKER_ID]);
    if (!claim.affectedRows)
        return 0;
    const [jobs] = await db_1.pool.execute("SELECT id, organization_id, created_by, payload, processed_rows FROM import_jobs WHERE locked_by = ? AND status = 'COMMITTING'", [db_1.WORKER_ID]);
    for (const job of jobs) {
        try {
            const rows = JSON.parse(job.payload);
            // Re-verify booth authorisation at commit time (booths may have been deactivated since preview)
            const [b] = await db_1.pool.execute("SELECT id FROM booths WHERE organization_id = ? AND status = 'ACTIVE'", [job.organization_id]);
            const allowed = new Set(b.map((x) => x.id));
            if (rows.some((r) => !allowed.has(r.boothId)))
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
                    await conn.execute(`INSERT INTO households (id, organization_id, booth_id, house_code, address_line) VALUES ${houses.map(() => "(?,?,?,?,?)").join(",")} ON DUPLICATE KEY UPDATE address_line = COALESCE(VALUES(address_line), address_line)`, houses.flatMap((r) => [(0, crypto_1.randomUUID)(), job.organization_id, r.boothId, r.houseCode, r.addressLine ?? null]));
                    const [hid] = await conn.execute(`SELECT id, booth_id, house_code FROM households WHERE deleted_at IS NULL AND (booth_id, house_code) IN (${houses.map(() => "(?,?)").join(",")})`, houses.flatMap((r) => [r.boothId, r.houseCode]));
                    const map = new Map(hid.map((h) => [`${h.booth_id}|${h.house_code}`, h.id]));
                    const people = slice.filter((r) => map.has(`${r.boothId}|${r.houseCode}`));
                    if (people.length)
                        await conn.execute(`INSERT INTO citizens (id, household_id, booth_id, full_name, relation, voter_id, life_status, roll_serial, age, gender) VALUES ${people.map(() => "(?,?,?,?,?,?,?,?,?,?)").join(",")} ON DUPLICATE KEY UPDATE id = id`, people.flatMap((r) => [(0, crypto_1.randomUUID)(), map.get(`${r.boothId}|${r.houseCode}`), r.boothId, r.fullName, r.relation, r.voterId, r.lifeStatus, r.rollSerial ?? null, r.age ?? null, r.gender ?? "UNKNOWN"]));
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
            await db_1.pool.execute("UPDATE import_jobs SET status = 'FAILED', last_error = ?, payload = NULL, locked_by = NULL WHERE id = ?", [errMsg(e), job.id]);
            await (0, db_1.audit)(job.created_by, "IMPORT", "IMPORT_JOB", job.id, errMsg(e), "FAILURE");
            db_1.log.error({ jobId: job.id, err: errMsg(e) }, "import failed");
        }
    }
    return jobs.length;
}
const ROSTER_SQL = `SELECT ci.id, b.code AS booth_code, h.house_code, h.address_line AS address, ci.roll_serial, ci.full_name, ci.relation, ci.voter_id, ci.age, ci.gender, ci.life_status,
            COALESCE(vp.passed_steps, 0) AS verification_steps, h.verification_status AS household_status
            FROM citizens ci JOIN households h ON h.id = ci.household_id JOIN booths b ON b.id = ci.booth_id
            LEFT JOIN (SELECT citizen_id, COUNT(*) AS passed_steps FROM verifications WHERE result = 'PASSED' GROUP BY citizen_id) vp ON vp.citizen_id = ci.id
           WHERE b.organization_id = ? AND h.deleted_at IS NULL AND ci.deleted_at IS NULL`;
const VERIFICATION_COLS = ["booth_code", "house_code", "address", "roll_serial", "full_name", "relation", "voter_id", "age", "gender", "life_status", "verification_steps", "household_status"];
const EXPORTS = {
    CITIZENS: { cols: ["booth_code", "house_code", "full_name", "relation", "voter_id", "life_status"],
        sql: `SELECT ci.id, b.code AS booth_code, h.house_code, ci.full_name, ci.relation, ci.voter_id, ci.life_status
            FROM citizens ci JOIN households h ON h.id = ci.household_id JOIN booths b ON b.id = ci.booth_id
           WHERE b.organization_id = ? AND h.deleted_at IS NULL AND ci.deleted_at IS NULL`, booth: "ci.booth_id" },
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
            const lines = [def.cols.join(",")];
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
                    lines.push(def.cols.map((c) => cell(c === "voter_id" ? mask(r[c]) : r[c] instanceof Date ? r[c].toISOString() : r[c])).join(","));
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
            await db_1.pool.execute("UPDATE export_jobs SET status = 'FAILED', last_error = ?, locked_by = NULL WHERE id = ?", [errMsg(e), job.id]);
            await (0, db_1.audit)(job.created_by, "EXPORT", "EXPORT_JOB", job.id, errMsg(e), "FAILURE");
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
