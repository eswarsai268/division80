"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = exports.WORKER_ID = exports.log = void 0;
exports.audit = audit;
const crypto_1 = require("crypto");
const promise_1 = __importDefault(require("mysql2/promise"));
const pino_1 = __importDefault(require("pino"));
exports.log = (0, pino_1.default)({ level: process.env.LOG_LEVEL ?? "info" });
exports.WORKER_ID = (0, crypto_1.randomUUID)();
exports.pool = promise_1.default.createPool({
    host: process.env.DATABASE_HOST, port: Number(process.env.DATABASE_PORT ?? 4000),
    user: process.env.DATABASE_USER, password: process.env.DATABASE_PASSWORD ?? "", database: process.env.DATABASE_NAME ?? "samasya_medhi",
    ssl: process.env.DATABASE_SSL === "true" ? { minVersion: "TLSv1.2" } : undefined,
    connectionLimit: 4, timezone: "Z",
});
async function audit(actor, action, type, id, reason, outcome = "SUCCESS") {
    await exports.pool.execute("INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, outcome, reason, request_id) VALUES (?,?,?,?,?,?,?,?)", [(0, crypto_1.randomUUID)(), actor, action, type, id, outcome, reason.slice(0, 250), `worker:${exports.WORKER_ID.slice(0, 8)}`]);
}
