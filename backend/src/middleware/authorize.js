"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = void 0;
const errors_1 = require("../errors");
const audit_1 = require("../services/audit");
const authorize = (...roles) => (req, _res, next) => {
    if (!req.user)
        return next((0, errors_1.unauthorized)());
    if (!roles.includes(req.user.role)) {
        void (0, audit_1.auditSafe)({ actorId: req.user.id, action: "ACCESS_DENIED", resourceType: "ROUTE",
            scope: req.path.slice(0, 90), outcome: "DENIED", reason: "role", requestId: String(req.id) });
        return next((0, errors_1.forbidden)());
    }
    next();
};
exports.authorize = authorize;
