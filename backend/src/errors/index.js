"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conflict = exports.notFound = exports.forbidden = exports.unauthorized = exports.AppError = void 0;
class AppError extends Error {
    status;
    code;
    details;
    constructor(status, code, message, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
exports.AppError = AppError;
const unauthorized = () => new AppError(401, "UNAUTHORIZED", "Authentication required");
exports.unauthorized = unauthorized;
const forbidden = () => new AppError(403, "FORBIDDEN", "You do not have access to this resource");
exports.forbidden = forbidden;
const notFound = () => new AppError(404, "RESOURCE_NOT_FOUND", "Resource not found");
exports.notFound = notFound;
const conflict = (m = "Conflict") => new AppError(409, "CONFLICT", m);
exports.conflict = conflict;
