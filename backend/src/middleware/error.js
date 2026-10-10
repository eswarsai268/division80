"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = void 0;
exports.errorHandler = errorHandler;
const errors_1 = require("../errors");
const logger_1 = require("../utils/logger");
const notFoundHandler = (_req, _res, next) => next(new errors_1.AppError(404, "RESOURCE_NOT_FOUND", "Resource not found"));
exports.notFoundHandler = notFoundHandler;
function errorHandler(err, req, res, _next) {
    const requestId = String(req.id);
    let status = 500, code = "INTERNAL_ERROR", message = "Something went wrong", details;
    if (err instanceof errors_1.AppError) {
        ({ status, code, message, details } = err);
    }
    else if (err?.type === "entity.parse.failed") {
        status = 400;
        code = "BAD_JSON";
        message = "Malformed JSON";
    }
    else if (err?.type === "entity.too.large") {
        status = 413;
        code = "PAYLOAD_TOO_LARGE";
        message = "Payload too large";
    }
    else if (err?.code === "ER_DUP_ENTRY") {
        status = 409;
        code = "CONFLICT";
        message = "Conflict";
    }
    if (status >= 500)
        logger_1.logger.error({ err, requestId }, "unhandled error"); // detail stays server-side
    res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) }, requestId });
}
