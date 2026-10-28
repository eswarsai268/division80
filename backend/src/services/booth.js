"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboard = dashboard;
exports.householdSummary = householdSummary;
const pool_1 = require("../db/pool");
const redis_1 = require("../cache/redis");
const jsonCache_1 = require("../cache/jsonCache");

async function dashboard(user) {
    if (user.role !== "BOOTH_MEMBER")
        return { booths: 0, households: { PENDING: 0, IN_VERIFICATION: 0, RESOLVED: 0 } };
    const key = (0, jsonCache_1.redisCacheKey)("dashboard", "booth", user.organizationId);
    return (0, jsonCache_1.getOrLoadJson)(redis_1.redis, key, 10, async () => {
        const [boothRow] = await (0, pool_1.query)("SELECT COUNT(*) AS count FROM booths WHERE organization_id = ? AND status = 'ACTIVE'", [user.organizationId]);
        const householdsByStatus = await (0, pool_1.query)(`SELECT verification_status AS status, COUNT(*) AS count
            FROM households WHERE organization_id = ? AND deleted_at IS NULL GROUP BY verification_status`, [user.organizationId]);
        const households = { PENDING: 0, IN_VERIFICATION: 0, RESOLVED: 0 };
        householdsByStatus.forEach((row) => { households[row.status] = Number(row.count); });
        return {
            booths: Number(boothRow.count),
            households,
            verifiedPeople: Number((await (0, pool_1.query)(`SELECT COUNT(*) AS count FROM citizens c JOIN households h ON h.id = c.household_id WHERE h.organization_id = ? AND c.deleted_at IS NULL AND h.deleted_at IS NULL AND (SELECT COUNT(*) FROM verifications v WHERE v.citizen_id = c.id AND v.result = 'PASSED') = 6`, [user.organizationId]))[0].count),
        };
    });
}

async function householdSummary(boothId) {
    const [row] = await (0, pool_1.query)("SELECT COUNT(*) AS count FROM households WHERE booth_id = ? AND deleted_at IS NULL", [boothId]);
    return { boothId, households: Number(row.count) };
}
