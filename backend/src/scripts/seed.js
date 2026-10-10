"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Creates the default organization and the FIRST admin from env vars. No demo citizen data is shipped.
const crypto_1 = require("crypto");
const password_1 = require("../auth/password");
const env_1 = require("../config/env");
const pool_1 = require("../db/pool");
async function main() {
    const email = process.env.SEED_ADMIN_EMAIL, pw = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !pw || pw.length < 12)
        throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (>=12 chars)");
    let org = (await (0, pool_1.query)("SELECT id FROM organizations WHERE slug = ?", [env_1.env.DEFAULT_ORG_SLUG]))[0];
    if (!org) {
        org = { id: (0, crypto_1.randomUUID)() };
        await (0, pool_1.exec)("INSERT INTO organizations (id, slug, name) VALUES (?,?,?)", [org.id, env_1.env.DEFAULT_ORG_SLUG, "Default Organization"]);
    }
    const exists = (await (0, pool_1.query)("SELECT id FROM users WHERE email = ?", [email.toLowerCase()]))[0];
    if (!exists)
        await (0, pool_1.exec)("INSERT INTO users (id, organization_id, email, password_hash, full_name, role) VALUES (?,?,?,?,?, 'ADMIN')", [(0, crypto_1.randomUUID)(), org.id, email.toLowerCase(), await (0, password_1.hashPassword)(pw), "Administrator"]);
    console.log("seed complete");
    await (0, pool_1.closePool)();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
