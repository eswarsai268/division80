"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = exports.WORKER_ID = exports.log = void 0;
const crypto_1 = require("crypto");
const promise_1 = __importDefault(require("mysql2/promise"));
const pino_1 = __importDefault(require("pino"));
const config_1 = require("./config");
exports.log = (0, pino_1.default)({ level: process.env.LOG_LEVEL ?? "info" });
exports.WORKER_ID = (0, crypto_1.randomUUID)();
const config = (0, config_1.getWorkerConfig)(process.env);
exports.config = config;
exports.pool = promise_1.default.createPool({
    host: config.databaseHost, port: config.databasePort,
    user: config.databaseUser, password: config.databasePassword, database: config.databaseName,
    ssl: config.databaseSsl === "true" ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
    connectionLimit: 4, timezone: "Z",
});
