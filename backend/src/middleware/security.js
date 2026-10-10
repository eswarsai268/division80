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
    if (req.headers["x-requested-with"] !== "samasya-web" || (origin && origin !== env_1.env.CORS_ORIGIN)) {
        return next(new errors_1.AppError(403, "CSRF_REJECTED", "Request rejected"));
    }
    next();
}
