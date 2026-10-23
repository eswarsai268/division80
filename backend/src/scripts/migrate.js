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
        ssl: env_1.env.DATABASE_SSL === "true" ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined, multipleStatements: true,
    });
    await c.query(`CREATE DATABASE IF NOT EXISTS \`${env_1.env.DATABASE_NAME.replace(/[^a-zA-Z0-9_]/g, "")}\``);
    await c.query(`USE \`${env_1.env.DATABASE_NAME.replace(/[^a-zA-Z0-9_]/g, "")}\``);
    await c.query("CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    const dir = path_1.default.resolve(__dirname, "../../../database/migrations");
    for (const f of fs_1.default.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
        const [done] = await c.query("SELECT 1 FROM schema_migrations WHERE name = ?", [f]);
        if (done.length)
            continue;
        if (f === "009_remove_citizen_accounts_complaints_cross_booth_and_audit.sql") {
            const uploadDir = path_1.default.resolve(env_1.env.UPLOAD_DIR);
            const [attachmentTable] = await c.query("SELECT COUNT(*) AS present FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'attachments'");
            const [attachments] = Number(attachmentTable[0].present) ? await c.query("SELECT object_key FROM attachments") : [[]];
            for (const row of attachments) {
                const key = String(row.object_key);
                const filename = path_1.default.basename(key);
                const file = path_1.default.resolve(uploadDir, filename);
                if (filename !== key || path_1.default.dirname(file) !== uploadDir)
                    throw new Error("Cannot safely remove an invalid complaint attachment path");
                try {
                    await fs_1.default.promises.unlink(file);
                }
                catch (error) {
                    if (error?.code !== "ENOENT")
                        throw error;
                }
            }
        }
        await c.query(fs_1.default.readFileSync(path_1.default.join(dir, f), "utf8"));
        await c.query("INSERT INTO schema_migrations (name) VALUES (?)", [f]);
        console.log("applied", f);
    }
    await c.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
