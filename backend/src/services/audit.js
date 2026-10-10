"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditSafe = void 0;
exports.audit = audit;
const crypto_1 = require("crypto");
const pool_1 = require("../db/pool");
// Never pass passwords, tokens or voter data into `reason`/`scope`.
async function audit(e, conn) {
    await (0, pool_1.exec)(`INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, scope, outcome, reason, request_id)
     VALUES (?,?,?,?,?,?,?,?,?)`, [(0, crypto_1.randomUUID)(), e.actorId ?? null, e.action, e.resourceType, e.resourceId ?? null, e.scope ?? null, e.outcome, e.reason ?? null, e.requestId], conn);
}
const auditSafe = (e) => audit(e).catch(() => undefined);
exports.auditSafe = auditSafe;
