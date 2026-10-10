"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const promise_1 = __importDefault(require("mysql2/promise"));
const env_1 = require("../config/env");
async function main() {
    const c = await promise_1.default.createConnection({
        host: env_1.env.DATABASE_HOST, port: env_1.env.DATABASE_PORT, user: env_1.env.DATABASE_USER, password: env_1.env.DATABASE_PASSWORD,
        ssl: env_1.env.DATABASE_SSL === "true" ? { minVersion: "TLSv1.2" } : undefined, multipleStatements: true,
    });
    await c.query(`CREATE DATABASE IF NOT EXISTS \`${env_1.env.DATABASE_NAME.replace(/[^a-zA-Z0-9_]/g, "")}\``);
    await c.query(`USE \`${env_1.env.DATABASE_NAME.replace(/[^a-zA-Z0-9_]/g, "")}\``);
    await c.query("CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    const dir = path_1.default.resolve(__dirname, "../../../database/migrations");
    for (const f of fs_1.default.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
        const [done] = await c.query("SELECT 1 FROM schema_migrations WHERE name = ?", [f]);
        if (done.length)
            continue;
        await c.query(fs_1.default.readFileSync(path_1.default.join(dir, f), "utf8"));
        await c.query("INSERT INTO schema_migrations (name) VALUES (?)", [f]);
        console.log("applied", f);
    }
    await c.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
