"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const crypto_1 = require("crypto");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const pino_http_1 = __importDefault(require("pino-http"));
const env_1 = require("./config/env");
const redis_1 = require("./cache/redis");
const pool_1 = require("./db/pool");
const error_1 = require("./middleware/error");
const rateLimit_1 = require("./middleware/rateLimit");
const security_1 = require("./middleware/security");
const routes_1 = __importDefault(require("./routes"));
const logger_1 = require("./utils/logger");
function createApp() {
    const app = (0, express_1.default)();
    app.disable("x-powered-by");
    app.set("trust proxy", env_1.env.TRUST_PROXY_HOPS); // 0 unless behind N known proxies, else IP spoofing bypasses rate limits
    app.use((0, pino_http_1.default)({
        logger: logger_1.logger,
        genReqId: (req, res) => { const id = (0, crypto_1.randomUUID)(); res.setHeader("X-Request-Id", id); return id; },
        serializers: { req: (r) => ({ id: r.id, method: r.method, url: String(r.url).split("?")[0] }) }, // no query strings in logs
    }));
    app.use((0, helmet_1.default)({ contentSecurityPolicy: { directives: { mediaSrc: ["'self'", "https://res.cloudinary.com"] } } }));
    app.use((0, cors_1.default)({ origin: env_1.env.CORS_ORIGIN, credentials: true, methods: ["GET", "POST", "PATCH", "DELETE"] }));
    app.get("/health", (_req, res) => res.json({ status: "ok" }));
    app.get("/ready", async (_req, res) => {
        try {
            await pool_1.pool.query("SELECT 1");
            if (redis_1.redis)
                await redis_1.redis.ping();
            res.json({ status: "ready" });
        }
        catch {
            res.status(503).json({ status: "unavailable" });
        }
    });
    app.use(rateLimit_1.limits.global);
    app.use("/api/v1/admin/import-jobs", express_1.default.json({ limit: "9mb" })); // CSV imports
    app.use("/api/v1/complaints", express_1.default.raw({ type: ["image/jpeg", "image/png"], limit: "5mb" })); // photo uploads
    app.use(express_1.default.json({ limit: "100kb" }));
    app.use((0, cookie_parser_1.default)());
    app.use(security_1.csrfGuard);
    app.use("/api", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
    app.use("/api/v1", routes_1.default);
    app.use(error_1.notFoundHandler);
    app.use(error_1.errorHandler);
    return app;
}
