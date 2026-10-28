"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./db");
const jobs_1 = require("./jobs");
const MAX_ATTEMPTS = 5, BATCH = 10, POLL_MS = 2000;
/**
 * SEND_NOTIFICATION delivery adapter. No SMS/email/push provider is configured yet (product decision):
 * until one is plugged in, notifications are only logged. Never log payload contents (personal data).
 */
async function deliver(n) { db_1.log.info({ outboxId: n.id, type: n.type }, "notification delivered (log adapter)"); }
async function processOutbox() {
    const [claim] = await db_1.pool.execute(`UPDATE notification_outbox SET status='PROCESSING', locked_by=?, locked_at=NOW(3), attempts=attempts+1
      WHERE status='PENDING' AND next_attempt_at <= NOW(3) ORDER BY created_at LIMIT ${BATCH}`, [db_1.WORKER_ID]);
    if (!claim.affectedRows)
        return 0;
    const [rows] = await db_1.pool.execute("SELECT id, type, attempts FROM notification_outbox WHERE status='PROCESSING' AND locked_by=?", [db_1.WORKER_ID]);
    for (const n of rows) {
        try {
            await deliver(n);
            await db_1.pool.execute("UPDATE notification_outbox SET status='SENT', locked_by=NULL WHERE id=?", [n.id]);
        }
        catch (e) {
            const dead = n.attempts >= MAX_ATTEMPTS; // FAILED == dead-letter
            await db_1.pool.execute("UPDATE notification_outbox SET status=?, locked_by=NULL, last_error=?, next_attempt_at=DATE_ADD(NOW(3), INTERVAL ? SECOND) WHERE id=?", [dead ? "FAILED" : "PENDING", String(e?.message ?? "error").slice(0, 250), 2 ** n.attempts * 5, n.id]);
        }
    }
    return rows.length;
}
let stopping = false;
async function main() {
    db_1.log.info({ workerId: db_1.WORKER_ID }, "worker started");
    let lastMaint = 0;
    while (!stopping) {
        try {
            const n = (await processOutbox()) + (await (0, jobs_1.processImports)()) + (await (0, jobs_1.processExports)()) + (await (0, jobs_1.processWhatsAppCampaigns)());
            if (Date.now() - lastMaint > 60_000) {
                await (0, jobs_1.maintenance)();
                lastMaint = Date.now();
            }
            if (n === 0)
                await new Promise((r) => setTimeout(r, POLL_MS));
        }
        catch (e) {
            db_1.log.error({ err: e }, "worker loop error");
            await new Promise((r) => setTimeout(r, 5000));
        }
    }
    await db_1.pool.end();
}
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });
void main();
