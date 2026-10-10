// Requires a migrated TEST database. Run:  TEST_DB=1 DATABASE_HOST=... npm test -w backend
// Uses synthetic data only — NEVER point this at a database containing real citizen data.
import { randomUUID } from "crypto";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
const enabled = !!process.env.TEST_DB;
process.env.JWT_ACCESS_SECRET ??= "t".repeat(40);
describe.skipIf(!enabled)("authorization (IDOR / RBAC / cross-booth)", () => {
    let app;
    let q;
    let hash;
    const H = { "X-Requested-With": "samasya-web" };
    const pw = "Correct-Horse-Battery-9";
    const ids = {};
    const login = async (email) => { const ag = request.agent(app); await ag.post("/api/v1/auth/login").set(H).send({ email, password: pw }).expect(200); return ag; };
    async function mkUser(role, name) {
        const id = randomUUID();
        const email = `${name}-${id.slice(0, 6)}@test.local`;
        await q.exec("INSERT INTO users (id, organization_id, email, password_hash, full_name, role) VALUES (?,?,?,?,?,?)", [id, ids.org, email, await hash(pw), name, role]);
        return { id, email };
    }
    async function assign(boothId, userId, approver = 0) {
        await q.exec("INSERT INTO booth_assignments (id, booth_id, user_id, can_approve_cross_booth, created_by) VALUES (?,?,?,?,?)", [randomUUID(), boothId, userId, approver, userId]);
    }
    const U = {};
    beforeAll(async () => {
        ids.org = randomUUID();
        process.env.DEFAULT_ORG_SLUG = `t-${ids.org.slice(0, 8)}`; // must be set BEFORE config is imported
        app = (await import("../src/app")).createApp();
        q = await import("../src/db/pool");
        hash = (await import("../src/auth/password")).hashPassword;
        await q.exec("INSERT INTO organizations (id, slug, name) VALUES (?,?,?)", [ids.org, process.env.DEFAULT_ORG_SLUG, "Test"]);
        for (const k of ["A", "B"]) {
            ids["booth" + k] = randomUUID();
            ids["house" + k] = randomUUID();
            await q.exec("INSERT INTO booths (id, organization_id, code, name) VALUES (?,?,?,?)", [ids["booth" + k], ids.org, k + randomUUID().slice(0, 4), "Booth " + k]);
            await q.exec("INSERT INTO households (id, organization_id, booth_id, house_code) VALUES (?,?,?,?)", [ids["house" + k], ids.org, ids["booth" + k], "G-24"]);
        }
        U.a1 = await mkUser("BOOTH_MEMBER", "a1");
        U.b1 = await mkUser("BOOTH_MEMBER", "b1");
        U.user1 = await mkUser("USER", "u1");
        U.user2 = await mkUser("USER", "u2");
        await assign(ids.boothA, U.a1.id, 1);
        await assign(ids.boothB, U.b1.id, 1);
    });
    it("T1/T2: booth A member cannot read booth B household (ID swap) -> 404/403", async () => {
        const ag = await login(U.a1.email);
        await ag.get(`/api/v1/booth/households/${ids.houseA}`).expect(200);
        const r = await ag.get(`/api/v1/booth/households/${ids.houseB}`);
        expect([403, 404]).toContain(r.status);
        await ag.get(`/api/v1/booth/households/${ids.houseB}/citizens`).expect(404);
    });
    it("T3: normal user cannot reach citizen/household data", async () => {
        const ag = await login(U.user1.email);
        await ag.get("/api/v1/booth/households").expect(403);
        await ag.get("/api/v1/admin/users").expect(403);
    });
    it("T4: user cannot read another user's complaint", async () => {
        const u1 = await login(U.user1.email), u2 = await login(U.user2.email);
        const c = await u1.post("/api/v1/complaints").set(H).send({ title: "Broken light", description: "Street light is broken", category: "LIGHTING" }).expect(201);
        await u1.get(`/api/v1/complaints/${c.body.data.id}`).expect(200);
        await u2.get(`/api/v1/complaints/${c.body.data.id}`).expect(404);
    });
    it("T5: revoked assignment loses access immediately", async () => {
        const ag = await login(U.a1.email);
        await ag.get(`/api/v1/booth/households/${ids.houseA}`).expect(200);
        await q.exec("UPDATE booth_assignments SET revoked_at = NOW(3) WHERE user_id = ?", [U.a1.id]);
        await ag.get(`/api/v1/booth/households/${ids.houseA}`).expect(404);
        await assign(ids.boothA, U.a1.id, 1);
    });
    it("T7/T10: requester cannot approve own request; approval cannot be replayed", async () => {
        const a = await login(U.a1.email), b = await login(U.b1.email);
        const r = await a.post("/api/v1/cross-booth/requests").set(H).send({ sourceBoothId: ids.boothA, householdId: ids.houseB, reason: "Joint verification" }).expect(201);
        const id = r.body.data.id;
        await a.post(`/api/v1/cross-booth/requests/${id}/approve`).set(H).send({}).expect(403);
        await a.get(`/api/v1/booth/households/${ids.houseB}`).expect(404); // not yet granted
        await b.post(`/api/v1/cross-booth/requests/${id}/approve`).set(H).send({ grantHours: 1 }).expect(200);
        await b.post(`/api/v1/cross-booth/requests/${id}/approve`).set(H).send({ grantHours: 1 }).expect(409); // replay
        await a.get(`/api/v1/booth/households/${ids.houseB}`).expect(200); // granted, resource-specific
    });
    it("approved VERIFY grants expose a roster and link each verification to the cross-booth request", async () => {
        const voterId = "XTEST12345";
        const citizenId = randomUUID();
        await q.exec("INSERT INTO citizens (id, household_id, booth_id, full_name, relation, voter_id, life_status) VALUES (?,?,?,?,?,?,?)",
            [citizenId, ids.houseB, ids.boothB, "Cross Booth Test Voter", "MEMBER", voterId, "ALIVE"]);
        const a = await login(U.a1.email), b = await login(U.b1.email);
        const created = await a.post("/api/v1/cross-booth/requests").set(H).send({
            sourceBoothId: ids.boothA, voterId, action: "VERIFY", reason: "Voter was found during door-to-door verification",
        }).expect(201);
        const id = created.body.data.id;
        await a.get(`/api/v1/cross-booth/requests/${id}/household`).expect(404);
        await b.post(`/api/v1/cross-booth/requests/${id}/approve`).set(H).send({ grantHours: 4 }).expect(200);
        const roster = await a.get(`/api/v1/cross-booth/requests/${id}/household`).expect(200);
        expect(roster.body.data.citizens[0].voterId).toBe(voterId);
        for (let step = 1; step <= 6; step++) {
            await a.post("/api/v1/booth/verifications").set(H).set("Idempotency-Key", randomUUID()).send({
                citizenId, step, result: "PASSED",
            }).expect(201);
        }
        const admin = await mkUser("ADMIN", "cross-audit-admin");
        const adminAgent = await login(admin.email);
        const report = await adminAgent.get("/api/v1/admin/cross-booth").expect(200);
        const entry = report.body.data.find((r) => r.id === id);
        expect(Number(entry.verificationCount)).toBe(6);
        const [linked] = await q.query("SELECT COUNT(*) AS n FROM verifications WHERE cross_booth_request_id = ?", [id]);
        expect(Number(linked.n)).toBe(6);
    });
    it("admin password changes require the current password, preserve the current session and revoke other sessions", async () => {
        const account = await mkUser("ADMIN", "password-change-admin");
        const activeSession = await login(account.email);
        const otherSession = await login(account.email);
        await activeSession.post("/api/v1/admin/settings/password/change").set(H).send({
            currentPassword: "Wrong-Current-Password",
            newPassword: "New-Secure-Password-2026",
        }).expect(403);
        await activeSession.get("/api/v1/admin/settings").expect(200);
        await activeSession.post("/api/v1/admin/settings/password/change").set(H).send({
            currentPassword: pw,
            newPassword: "New-Secure-Password-2026",
        }).expect(200);
        await activeSession.get("/api/v1/admin/settings").expect(200);
        await otherSession.get("/api/v1/admin/settings").expect(401);
        await request(app).post("/api/v1/auth/login").set(H).send({ email: account.email, password: pw }).expect(401);
        await request(app).post("/api/v1/auth/login").set(H).send({
            email: account.email,
            password: "New-Secure-Password-2026",
        }).expect(200);
    });
    it("T6: expired grant is denied", async () => {
        const a = await login(U.a1.email);
        await q.exec("UPDATE cross_booth_requests SET grant_expires_at = DATE_SUB(NOW(3), INTERVAL 1 MINUTE) WHERE requester_id = ?", [U.a1.id]);
        await a.get(`/api/v1/booth/households/${ids.houseB}`).expect(404);
    });
    it("T8/T9: client-supplied role / user_id are ignored", async () => {
        const reg = await request(app).post("/api/v1/auth/register").set(H).send({ email: `x-${randomUUID().slice(0, 6)}@test.local`, password: pw, fullName: "Mallory", role: "ADMIN", user_id: U.user1.id });
        expect(reg.status).toBe(201);
        const [row] = await q.query("SELECT role FROM users WHERE id = ?", [reg.body.data.id]);
        expect(row.role).toBe("USER");
        const ag = await login(U.user2.email);
        const c = await ag.post("/api/v1/complaints").set(H).send({ title: "Spoof", description: "Trying identity swap", category: "OTHER", user_id: U.user1.id }).expect(201);
        const [own] = await q.query("SELECT user_id FROM complaints WHERE id = ?", [c.body.data.id]);
        expect(own.user_id).toBe(U.user2.id);
    });
    it("CSRF: mutating request without header is rejected", async () => {
        const ag = await login(U.user1.email);
        await ag.post("/api/v1/complaints").send({ title: "x", description: "y".repeat(12), category: "OTHER" }).expect(403);
    });
});
