"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboard = dashboard;
exports.householdSummary = householdSummary;
const pool_1 = require("../db/pool");

async function dashboard(user) {
    if (user.role !== "BOOTH_MEMBER")
        return { booths: 0, households: { PENDING: 0, IN_VERIFICATION: 0, RESOLVED: 0 } };
    const [boothRow] = await (0, pool_1.query)("SELECT COUNT(*) AS count FROM booths WHERE organization_id = ? AND status = 'ACTIVE'", [user.organizationId]);
    const householdsByStatus = await (0, pool_1.query)(`SELECT verification_status AS status, COUNT(*) AS count
        FROM households WHERE organization_id = ? AND deleted_at IS NULL GROUP BY verification_status`, [user.organizationId]);
    const households = { PENDING: 0, IN_VERIFICATION: 0, RESOLVED: 0 };
    householdsByStatus.forEach((row) => { households[row.status] = Number(row.count); });
    return {
        booths: Number(boothRow.count),
        households,
    };
}

async function householdSummary(boothId) {
    const [row] = await (0, pool_1.query)("SELECT COUNT(*) AS count FROM households WHERE booth_id = ? AND deleted_at IS NULL", [boothId]);
    return { boothId, households: Number(row.count) };
}
