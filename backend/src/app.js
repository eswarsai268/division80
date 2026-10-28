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
function createApp(dependencies = {}) {
    const readinessPool = dependencies.pool ?? pool_1.pool;
    const readinessRedis = dependencies.redis ?? redis_1.redis;
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
            await readinessPool.query("SELECT 1");
            if (readinessRedis)
                await readinessRedis.ping();
            res.json({ status: "ready" });
        }
        catch {
            res.status(503).json({ status: "unavailable" });
        }
    });
    // Keep the shared API ceiling for application routes but exempt the login endpoint.
    app.use((req, res, next) => {
        const path = req.originalUrl.split("?", 1)[0].toLowerCase();
        if (req.method === "POST" && ["/api/v1/auth/login", "/api/v1/auth/login/"].includes(path))
            return next();
        return rateLimit_1.limits.global(req, res, next);
    });
    app.use("/api/v1/admin/import-jobs", express_1.default.text({ type: "text/csv", limit: "50mb" }));
    app.use("/api/v1/admin/import-jobs", express_1.default.json({ limit: "102mb" })); // 50 MiB CSV plus JSON escaping
    app.use(express_1.default.json({ limit: "100kb" }));
    app.use((0, cookie_parser_1.default)());
    app.use(security_1.csrfGuard);
    app.use("/api", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
    app.use("/api/v1", routes_1.default);
    app.use(error_1.notFoundHandler);
    app.use(error_1.errorHandler);
    return app;
}
