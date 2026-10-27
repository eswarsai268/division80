"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrfGuard = csrfGuard;
const env_1 = require("../config/env");
const errors_1 = require("../errors");
/** CSRF defence for cookie auth: SameSite=Strict cookies + custom header + Origin check on mutating requests. */
function csrfGuard(req, _res, next) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method))
        return next();
    const origin = req.headers.origin;
    if (req.headers["x-requested-with"] !== "samasya-web" || (origin && !isAllowedOrigin(origin))) {
        return next(new errors_1.AppError(403, "CSRF_REJECTED", "Request rejected"));
    }
    next();
}
function isAllowedOrigin(origin) {
    if (origin === env_1.env.CORS_ORIGIN)
        return true;
    // Vite may move from 5173 to 5174 when the default port is already occupied.
    // Permit same-host loopback origins only in development; production remains exact-match.
    if (env_1.env.NODE_ENV !== "development")
        return false;
    try {
        const actual = new URL(origin);
        const configured = new URL(env_1.env.CORS_ORIGIN);
        const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
        return actual.origin === origin
            && actual.protocol === configured.protocol
            && actual.hostname === configured.hostname
            && loopbackHosts.has(actual.hostname)
            && loopbackHosts.has(configured.hostname);
    }
    catch {
        return false;
    }
}
