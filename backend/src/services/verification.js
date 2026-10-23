"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STEPS = void 0;
exports.nextStep = nextStep;
exports.recordVerification = recordVerification;
exports.getVerificationForUser = getVerificationForUser;
const crypto_1 = require("crypto");
const pool_1 = require("../db/pool");
const errors_1 = require("../errors");
const boothAssignments_1 = require("../repositories/boothAssignments");
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
        // Read the resource without a lock to discover its booth; permission locks follow
        // user -> assignment -> booth before the citizen row is locked for the write.
        const candidate = (await (0, pool_1.query)("SELECT id, household_id, booth_id FROM citizens WHERE id = ? AND deleted_at IS NULL", [input.citizenId], conn))[0];
        if (!candidate)
            throw (0, errors_1.notFound)();
        if (!(await (0, boothAssignments_1.lockActiveBoothAssignment)(conn, c.user.id, c.user.organizationId, candidate.booth_id)))
            throw (0, errors_1.notFound)();
        const access = (await (0, pool_1.query)(`SELECT h.id FROM households h JOIN booths b ON b.id = h.booth_id
            WHERE h.id = ? AND h.booth_id = ? AND h.organization_id = ? AND h.deleted_at IS NULL
              AND b.organization_id = ? AND b.status = 'ACTIVE' FOR UPDATE`,
        [candidate.household_id, candidate.booth_id, c.user.organizationId, c.user.organizationId], conn))[0];
        if (!access)
            throw (0, errors_1.notFound)();
        // Re-read under lock after permission checks and reject if the resource moved or was archived.
        const cit = (await (0, pool_1.query)("SELECT id, household_id, booth_id FROM citizens WHERE id = ? AND deleted_at IS NULL FOR UPDATE", [input.citizenId], conn))[0];
        if (!cit || cit.booth_id !== candidate.booth_id || cit.household_id !== candidate.household_id)
            throw (0, errors_1.notFound)();
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
        await (0, pool_1.exec)(`INSERT INTO verifications (id, citizen_id, household_id, booth_id, step, result, verifier_id, notes, idempotency_key)
       VALUES (?,?,?,?,?,?,?,?,?)`, [id, cit.id, cit.household_id, cit.booth_id, input.step, input.result, c.user.id, input.notes ?? null, idempotencyKey ?? null], conn);
        // Household rollup (derived state, computed server-side only)
        const open = (await (0, pool_1.query)(`SELECT COUNT(*) AS n FROM citizens ci WHERE ci.household_id = ? AND ci.deleted_at IS NULL
         AND (SELECT COUNT(*) FROM verifications v WHERE v.citizen_id = ci.id AND v.result = 'PASSED') < 6`, [cit.household_id], conn))[0].n;
        await (0, pool_1.exec)("UPDATE households SET verification_status = ? WHERE id = ?", [Number(open) === 0 ? "RESOLVED" : "IN_VERIFICATION", cit.household_id], conn);
        return { id, step: input.step, result: input.result, replayed: false };
    });
}
async function getVerificationForUser(c, id) {
    if (c.user.boothIds.length === 0)
        throw (0, errors_1.notFound)();
    const ph = c.user.boothIds.map(() => "?").join(",");
    const r = (await (0, pool_1.query)(`SELECT v.id, v.citizen_id AS citizenId, v.household_id AS householdId, v.booth_id AS boothId, v.step, v.result, v.notes, v.created_at AS createdAt
       FROM verifications v WHERE v.id = ? AND v.booth_id IN (${ph})`, [id, ...c.user.boothIds]))[0];
    if (!r)
        throw (0, errors_1.notFound)();
    return r;
}
