"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.limits = exports.limiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rate_limit_redis_1 = __importDefault(require("rate-limit-redis"));
const redis_1 = require("../cache/redis");
const limiter = (name, limit, windowMs, key) => (0, express_rate_limit_1.default)({
    windowMs, limit, standardHeaders: true, legacyHeaders: false,
    keyGenerator: key ?? ((r) => r.ip ?? "unknown"),
    store: redis_1.redis ? new rate_limit_redis_1.default({ prefix: `rl:${name}:`, sendCommand: (...args) => redis_1.redis.sendCommand(args) }) : undefined,
    handler: (req, res) => {
        res.status(429).json({ success: false, error: { code: "RATE_LIMITED", message: "Too many requests" }, requestId: String(req.id) });
    },
});
exports.limiter = limiter;
const byUser = (r) => r.user?.id ?? r.ip ?? "unknown";
const MIN = 60_000, HOUR = 60 * MIN;
exports.limits = {
    global: (0, exports.limiter)("global", 600, MIN),
    login: (0, exports.limiter)("login", 10, 15 * MIN, (r) => `${r.ip}:${String(r.body?.email ?? "").toLowerCase().slice(0, 100)}`),
    // Include the source IP so a remote attacker cannot lock a known account out
    // merely by exhausting an email-only bucket.
    loginEmail: (0, exports.limiter)("loginEmail", 20, HOUR, (r) => `${r.ip ?? "unknown"}:${String(r.body?.email ?? "").toLowerCase().slice(0, 100)}`),
    passwordChange: (0, exports.limiter)("passwordChange", 5, HOUR, byUser),
    refresh: (0, exports.limiter)("refresh", 60, 15 * MIN),
    search: (0, exports.limiter)("search", 120, MIN, byUser),
    verification: (0, exports.limiter)("verify", 300, MIN, byUser),
    importJobs: (0, exports.limiter)("imports", 20, HOUR, byUser),
    exportJobs: (0, exports.limiter)("exports", 10, HOUR, byUser),
    admin: (0, exports.limiter)("admin", 120, MIN, byUser),
};
