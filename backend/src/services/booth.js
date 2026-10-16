"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboard = dashboard;
exports.householdSummary = householdSummary;
const pool_1 = require("../db/pool");

async function dashboard(user) {
    if (!user.boothIds.length)
        return { booths: 0, households: { PENDING: 0, IN_VERIFICATION: 0, RESOLVED: 0 }, complaints: {} };
    const placeholders = user.boothIds.map(() => "?").join(",");
    const householdsByStatus = await (0, pool_1.query)(`SELECT verification_status AS status, COUNT(*) AS count
        FROM households WHERE booth_id IN (${placeholders}) AND deleted_at IS NULL GROUP BY verification_status`, user.boothIds);
    const complaintsByStatus = await (0, pool_1.query)(`SELECT status, COUNT(*) AS count
        FROM complaints WHERE assigned_booth_id IN (${placeholders}) GROUP BY status`, user.boothIds);
    const households = { PENDING: 0, IN_VERIFICATION: 0, RESOLVED: 0 };
    householdsByStatus.forEach((row) => { households[row.status] = Number(row.count); });
    return {
        booths: user.boothIds.length,
        households,
        complaints: Object.fromEntries(complaintsByStatus.map((row) => [row.status, Number(row.count)])),
    };
}

async function householdSummary(boothId) {
    const [row] = await (0, pool_1.query)("SELECT COUNT(*) AS count FROM households WHERE booth_id = ? AND deleted_at IS NULL", [boothId]);
    return { boothId, households: Number(row.count) };
}
