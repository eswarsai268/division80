"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireBoothAccess = void 0;
const errors_1 = require("../errors");
/** For routes with :boothId — the booth must be in the caller's ACTIVE assignments. */
const requireBoothAccess = (param = "boothId") => (req, _res, next) => {
    if (!req.user)
        return next((0, errors_1.unauthorized)());
    const id = req.params[param];
    if (!id || !req.user.boothIds.includes(id))
        return next((0, errors_1.forbidden)());
    next();
};
exports.requireBoothAccess = requireBoothAccess;
