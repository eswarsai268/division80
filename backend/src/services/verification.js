"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STEPS = void 0;
exports.nextStep = nextStep;
exports.recordVerification = recordVerification;
exports.getVerificationForUser = getVerificationForUser;
const crypto_1 = require("crypto");
const pool_1 = require("../db/pool");
const errors_1 = require("../errors");
const audit_1 = require("./audit");
exports.STEPS = ["Record verification", "Voter ID check", "Life status", "T+Live circle", "Detail verification", "Double check"];
/** Steps must be passed strictly in order. Returns the next required step, or null when all 6 passed. */
function nextStep(passed) {
    for (let s = 1; s <= 6; s++)
        if (!passed.includes(s))
            return s;
    return null;
}
async function recordVerification(c, input, idempotencyKey) {
    if (c.user.role !== "BOOTH_MEMBER")
        throw (0, errors_1.forbidden)();
    return (0, pool_1.tx)(async (conn) => {
        // Lock the citizen row: serialises concurrent verifications of the same person.
        const cit = (await (0, pool_1.query)("SELECT id, household_id, booth_id FROM citizens WHERE id = ? AND deleted_at IS NULL FOR UPDATE", [input.citizenId], conn))[0];
        if (!cit)
            throw (0, errors_1.notFound)();
        let crossRequestId = null;
        if (!c.user.boothIds.includes(cit.booth_id)) {
            const grant = (await (0, pool_1.query)(`SELECT r.id, r.source_booth_id AS sourceBoothId FROM cross_booth_requests r
              JOIN booth_assignments a ON a.booth_id = r.source_booth_id AND a.user_id = r.requester_id
              JOIN booths target ON target.id = r.target_booth_id AND target.status = 'ACTIVE'
              JOIN households h ON h.id = r.resource_id AND h.booth_id = r.target_booth_id AND h.deleted_at IS NULL
             WHERE r.requester_id = ? AND r.resource_id = ? AND r.target_booth_id = ? AND r.action = 'VERIFY'
               AND r.status = 'APPROVED' AND r.grant_expires_at > NOW(3)
               AND a.revoked_at IS NULL AND a.starts_at <= NOW(3) AND (a.ends_at IS NULL OR a.ends_at > NOW(3))
             ORDER BY r.grant_expires_at DESC LIMIT 1`, [c.user.id, cit.household_id, cit.booth_id], conn))[0];
            if (!grant || !c.user.boothIds.includes(grant.sourceBoothId))
                throw (0, errors_1.notFound)();
            crossRequestId = grant.id;
        }
        if (idempotencyKey) {
            const prev = (await (0, pool_1.query)("SELECT id, citizen_id, step, result FROM verifications WHERE verifier_id = ? AND idempotency_key = ?", [c.user.id, idempotencyKey], conn))[0];
            if (prev && (prev.citizen_id !== input.citizenId || prev.step !== input.step))
                throw (0, errors_1.conflict)("Idempotency key was used for a different request");
            if (prev)
                return { id: prev.id, step: prev.step, result: prev.result, replayed: true };
        }
        const passed = (await (0, pool_1.query)("SELECT step FROM verifications WHERE citizen_id = ? AND result = 'PASSED'", [cit.id], conn)).map((r) => r.step);
        const expected = nextStep(passed);
        if (expected === null)
            throw (0, errors_1.conflict)("All verification steps are already completed");
        if (input.step !== expected)
            throw new errors_1.AppError(409, "INVALID_STEP", `Step ${expected} must be recorded next`);
        const id = (0, crypto_1.randomUUID)();
        await (0, pool_1.exec)(`INSERT INTO verifications (id, citizen_id, household_id, booth_id, step, result, verifier_id, notes, idempotency_key, cross_booth_request_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`, [id, cit.id, cit.household_id, cit.booth_id, input.step, input.result, c.user.id, input.notes ?? null, idempotencyKey ?? null, crossRequestId], conn);
        // Household rollup (derived state, computed server-side only)
        const open = (await (0, pool_1.query)(`SELECT COUNT(*) AS n FROM citizens ci WHERE ci.household_id = ? AND ci.deleted_at IS NULL
         AND (SELECT COUNT(*) FROM verifications v WHERE v.citizen_id = ci.id AND v.result = 'PASSED') < 6`, [cit.household_id], conn))[0].n;
        await (0, pool_1.exec)("UPDATE households SET verification_status = ? WHERE id = ?", [Number(open) === 0 ? "RESOLVED" : "IN_VERIFICATION", cit.household_id], conn);
        await (0, audit_1.audit)({ actorId: c.user.id, action: "CITIZEN_VERIFICATION", resourceType: "CITIZEN", resourceId: cit.id,
            scope: crossRequestId ? `cross-booth:${crossRequestId}` : `booth:${cit.booth_id}`, outcome: "SUCCESS", reason: `step ${input.step} ${input.result}`, requestId: c.requestId }, conn);
        return { id, step: input.step, result: input.result, replayed: false };
    });
}
async function getVerificationForUser(c, id) {
    if (c.user.boothIds.length === 0)
        throw (0, errors_1.notFound)();
    const ph = c.user.boothIds.map(() => "?").join(",");
    const r = (await (0, pool_1.query)(`SELECT id, citizen_id AS citizenId, household_id AS householdId, booth_id AS boothId, step, result, notes, created_at AS createdAt
       FROM verifications WHERE id = ? AND booth_id IN (${ph})`, [id, ...c.user.boothIds]))[0];
    if (!r)
        throw (0, errors_1.notFound)();
    return r;
}
