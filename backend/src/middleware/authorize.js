"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = void 0;
const errors_1 = require("../errors");
const authorize = (...roles) => (req, _res, next) => {
    if (!req.user)
        return next((0, errors_1.unauthorized)());
    if (!roles.includes(req.user.role)) {
        return next((0, errors_1.forbidden)());
    }
    next();
};
exports.authorize = authorize;
