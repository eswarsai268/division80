"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closePool = exports.placeholders = exports.pool = void 0;
exports.query = query;
exports.exec = exec;
exports.tx = tx;
const promise_1 = __importDefault(require("mysql2/promise"));
const env_1 = require("../config/env");
/**
 * Pool sizing: connections_per_replica = floor(db_safe_max_connections * 0.7 / api_replicas).
 * Example: TiDB allows 1000 conns, 6 replicas -> ~116 max; we default to 20 and tune after load tests.
 * 50,000 users never means 50,000 connections: requests queue in the API (queueLimit) and are shed beyond it.
 */
exports.pool = promise_1.default.createPool({
    host: env_1.env.DATABASE_HOST,
    port: env_1.env.DATABASE_PORT,
    user: env_1.env.DATABASE_USER,
    password: env_1.env.DATABASE_PASSWORD,
    database: env_1.env.DATABASE_NAME,
    ssl: env_1.env.DATABASE_SSL === "true" ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
    connectionLimit: env_1.env.DATABASE_CONNECTION_LIMIT,
    waitForConnections: true,
    queueLimit: 500,
    connectTimeout: 10_000,
    timezone: "Z",
});
const QUERY_TIMEOUT_MS = 10_000;
async function query(sql, params = [], conn = exports.pool) {
    const [rows] = await conn.execute({ sql, timeout: QUERY_TIMEOUT_MS }, params);
    return rows;
}
async function exec(sql, params = [], conn = exports.pool) {
    const [res] = await conn.execute({ sql, timeout: QUERY_TIMEOUT_MS }, params);
    return res;
}
async function tx(fn) {
    const c = await exports.pool.getConnection();
    let transactionFailed = false;
    try {
        await c.beginTransaction();
        const out = await fn(c);
        await c.commit();
        return out;
    }
    catch (e) {
        transactionFailed = true;
        try {
            await c.rollback();
        }
        catch {
            // Keep the transaction failure as the primary error.
        }
        throw e;
    }
    finally {
        try {
            c.release();
        }
        catch (releaseError) {
            if (!transactionFailed)
                throw releaseError;
        }
    }
}
const placeholders = (n) => Array(n).fill("?").join(",");
exports.placeholders = placeholders;
const closePool = () => exports.pool.end();
exports.closePool = closePool;
