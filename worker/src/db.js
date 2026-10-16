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
const config_1 = require("./config");
exports.log = (0, pino_1.default)({ level: process.env.LOG_LEVEL ?? "info" });
exports.WORKER_ID = (0, crypto_1.randomUUID)();
const config = (0, config_1.getWorkerConfig)(process.env);
exports.pool = promise_1.default.createPool({
    host: config.databaseHost, port: config.databasePort,
    user: config.databaseUser, password: config.databasePassword, database: config.databaseName,
    ssl: config.databaseSsl === "true" ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
    connectionLimit: 4, timezone: "Z",
});
async function audit(actor, action, type, id, reason, outcome = "SUCCESS") {
    await exports.pool.execute("INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, outcome, reason, request_id) VALUES (?,?,?,?,?,?,?,?)", [(0, crypto_1.randomUUID)(), actor, action, type, id, outcome, reason.slice(0, 250), `worker:${exports.WORKER_ID.slice(0, 8)}`]);
}
