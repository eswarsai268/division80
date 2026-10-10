"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pageQuery = exports.uuid = exports.ok = exports.h = void 0;
exports.parse = parse;
exports.ctx = ctx;
const zod_1 = require("zod");
const errors_1 = require("../errors");
const h = (fn) => (req, res, next) => { fn(req, res, next).catch(next); };
exports.h = h;
function parse(schema, data) {
    const r = schema.safeParse(data);
    if (!r.success) {
        throw new errors_1.AppError(422, "VALIDATION_ERROR", "Invalid request", r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    }
    return r.data;
}
const ok = (req, res, data, status = 200) => res.status(status).json({ success: true, data, requestId: String(req.id) });
exports.ok = ok;
function ctx(req) {
    if (!req.user)
        throw (0, errors_1.unauthorized)(); // fail closed
    return { user: req.user, requestId: String(req.id) };
}
exports.uuid = zod_1.z.string().uuid();
exports.pageQuery = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(25),
    cursor: zod_1.z.string().uuid().optional(),
});
