// Requires a migrated TEST database. Run:  TEST_DB=1 DATABASE_HOST=... npm test -w backend
// Uses synthetic data only — NEVER point this at a database containing real citizen data.
import { randomUUID } from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isAuthzDatabaseTestEnabled } from "./authzTestGate.mjs";
const enabled = isAuthzDatabaseTestEnabled(process.env);
process.env.JWT_ACCESS_SECRET ??= "t".repeat(40);
describe.skipIf(!enabled)("authorization (IDOR / RBAC / cross-booth)", () => {
    let app;
    let q;
    let hash;
    const H = { "X-Requested-With": "samasya-web" };
    const pw = "Correct-Horse-Battery-9";
    const ids = {};
    const originalUploadDir = process.env.UPLOAD_DIR;
    let uploadDir;
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
        uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "samasya-authz-uploads-"));
        process.env.UPLOAD_DIR = uploadDir;
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
    afterAll(async () => {
        if (originalUploadDir === undefined)
            delete process.env.UPLOAD_DIR;
        else
            process.env.UPLOAD_DIR = originalUploadDir;
        if (uploadDir)
            await fs.rm(uploadDir, { recursive: true, force: true });
    });
    it("Booth Members can read organization households across booths but cannot write to unassigned booths", async () => {
        const ag = await login(U.a1.email);
        await ag.get(`/api/v1/booth/households/${ids.houseA}`).expect(200);
        const citizenId = randomUUID();
        const voterId = `TEST${randomUUID().replace(/-/g, "").slice(0, 16)}`;
        await q.exec("INSERT INTO citizens (id, household_id, booth_id, full_name, relation, voter_id, life_status) VALUES (?,?,?,?,?,?,?)",
            [citizenId, ids.houseB, ids.boothB, "Other Booth Resident", "MEMBER", voterId, "ALIVE"]);
        const list = await ag.get("/api/v1/booth/households").expect(200);
        expect(list.body.data.items.some((household) => household.id === ids.houseB)).toBe(true);
        const booths = await ag.get("/api/v1/booth/booths").expect(200);
        expect(booths.body.data.some((booth) => booth.id === ids.boothB)).toBe(true);
        const me = await ag.get("/api/v1/auth/me").expect(200);
        expect(me.body.data.boothIds).toContain(ids.boothA);
        expect(me.body.data.boothIds).not.toContain(ids.boothB);
        await ag.get("/api/v1/admin/assignments").expect(403);
        const detail = await ag.get(`/api/v1/booth/households/${ids.houseB}/citizens`).expect(200);
        expect(detail.body.data.household.ownBooth).toBe(false);
        expect(detail.body.data.citizens[0].voterId).toBe(`****${voterId.slice(-4)}`);
        await ag.patch(`/api/v1/booth/citizens/${citizenId}/visit`).set(H).send({
            lifeStatus: "ALIVE", verificationDone: true, notHere: false, addressChanged: false,
            newAddress: "", visitNotes: "",
        }).expect(404);
        await ag.post("/api/v1/booth/verifications").set(H).send({ citizenId, step: 1, result: "PASSED" }).expect(404);

        const inactiveBooth = randomUUID(), inactiveHouse = randomUUID();
        await q.exec("INSERT INTO booths (id, organization_id, code, name, status) VALUES (?,?,?,?, 'INACTIVE')", [inactiveBooth, ids.org, `INACTIVE-${inactiveBooth.slice(0, 6)}`, "Inactive booth"]);
        await q.exec("INSERT INTO households (id, organization_id, booth_id, house_code) VALUES (?,?,?,?)", [inactiveHouse, ids.org, inactiveBooth, "INACTIVE-1"]);
        const activeBooths = await ag.get("/api/v1/booth/booths").expect(200);
        expect(activeBooths.body.data.some((booth) => booth.id === inactiveBooth)).toBe(false);
        const activeHouses = await ag.get("/api/v1/booth/households").expect(200);
        expect(activeHouses.body.data.items.some((household) => household.id === inactiveHouse)).toBe(false);
        await ag.get(`/api/v1/booth/households/${inactiveHouse}`).expect(404);

        const otherOrg = randomUUID(), otherBooth = randomUUID(), otherHouse = randomUUID();
        await q.exec("INSERT INTO organizations (id, slug, name) VALUES (?,?,?)", [otherOrg, `other-${otherOrg.slice(0, 8)}`, "Other test org"]);
        await q.exec("INSERT INTO booths (id, organization_id, code, name) VALUES (?,?,?,?)", [otherBooth, otherOrg, "OTHER", "Other organization"]);
        await q.exec("INSERT INTO households (id, organization_id, booth_id, house_code) VALUES (?,?,?,?)", [otherHouse, otherOrg, otherBooth, "OTHER-1"]);
        const all = await ag.get("/api/v1/booth/households").expect(200);
        expect(all.body.data.items.some((household) => household.id === otherHouse)).toBe(false);
        await ag.get(`/api/v1/booth/households/${otherHouse}`).expect(404);
    });
    it("T3: normal user cannot reach citizen/household data", async () => {
        const ag = await login(U.user1.email);
        await ag.get("/api/v1/booth/households").expect(403);
        await ag.get("/api/v1/admin/users").expect(403);
    });
    it("admin can create a booth member login and assign it to the booth in one operation", async () => {
        const admin = await mkUser("ADMIN", "booth-provision-admin");
        const agent = await login(admin.email);
        const email = `new-booth-member-${randomUUID().slice(0, 8)}@test.local`;
        const created = await agent.post("/api/v1/admin/booths").set(H).send({
            code: `PROV-${randomUUID().slice(0, 8)}`,
            name: "Provisioned booth",
            member: {
                email,
                fullName: "Provisioned Member",
                password: pw,
                canApproveCrossBooth: true,
            },
        }).expect(201);
        const boothId = created.body.data.id;
        const member = await login(email);
        const profile = await member.get("/api/v1/auth/me").expect(200);
        expect(profile.body.data.role).toBe("BOOTH_MEMBER");
        expect(profile.body.data.boothIds).toContain(boothId);
        expect(profile.body.data.approverBoothIds).toContain(boothId);
    });
    it("admin booth-member creation accepts an eight-character password and rejects shorter passwords", async () => {
        const admin = await mkUser("ADMIN", "password-minimum-admin");
        const agent = await login(admin.email);
        const email = `eight-char-member-${randomUUID().slice(0, 8)}@test.local`;
        const payload = {
            email, fullName: "Eight Character Member", role: "BOOTH_MEMBER", boothId: ids.boothA,
            canApproveCrossBooth: false,
        };

        await agent.post("/api/v1/admin/users").set(H).send({ ...payload, password: "Short7!" }).expect(422);
        await agent.post("/api/v1/admin/users").set(H).send({ ...payload, password: "Eight888" }).expect(201);
        const member = await login(email);
        const profile = await member.get("/api/v1/auth/me").expect(200);
        expect(profile.body.data.boothIds).toContain(ids.boothA);
    });
    it.each([
        { label: "suspension", change: { status: "SUSPENDED" }, expectedStatus: "SUSPENDED", expectedRole: "BOOTH_MEMBER" },
        { label: "demotion", change: { role: "USER" }, expectedStatus: "ACTIVE", expectedRole: "USER" },
    ])("serializes assignment creation with account $label", async ({ change, expectedStatus, expectedRole }) => {
        const member = await mkUser("BOOTH_MEMBER", "assignment-suspension-race");
        const admin = await mkUser("ADMIN", "assignment-suspension-admin");
        const agent = await login(admin.email);
        const lock = await q.pool.getConnection();
        let transactionOpen = false;
        try {
            await lock.beginTransaction();
            transactionOpen = true;
            await lock.execute("SELECT id FROM users WHERE id = ? FOR UPDATE", [member.id]);

            const assignmentRequest = agent.post(`/api/v1/admin/booths/${ids.boothA}/assignments`).set(H)
                .send({ userId: member.id, canApproveCrossBooth: true });
            const suspensionRequest = agent.patch(`/api/v1/admin/users/${member.id}`).set(H)
                .send(change);

            // Let both API operations reach the database while the target row is held.
            await new Promise((resolve) => setTimeout(resolve, 100));
            await lock.commit();
            transactionOpen = false;

            const [assignment, suspension] = await Promise.all([assignmentRequest, suspensionRequest]);
            expect(suspension.status).toBe(200);
            expect([201, 404]).toContain(assignment.status);

            const [user] = await q.query("SELECT status, role FROM users WHERE id = ?", [member.id]);
            const [active] = await q.query("SELECT COUNT(*) AS n FROM booth_assignments WHERE user_id = ? AND revoked_at IS NULL", [member.id]);
            expect(user.status).toBe(expectedStatus);
            expect(user.role).toBe(expectedRole);
            expect(Number(active.n)).toBe(0);
            if (change.status === "SUSPENDED") {
                await agent.patch(`/api/v1/admin/users/${member.id}`).set(H).send({ status: "ACTIVE" }).expect(200);
                const [afterReactivation] = await q.query("SELECT COUNT(*) AS n FROM booth_assignments WHERE user_id = ? AND revoked_at IS NULL", [member.id]);
                expect(Number(afterReactivation.n)).toBe(0);
            }
        }
        finally {
            if (transactionOpen)
                await lock.rollback();
            lock.release();
        }
    });
    it("profile PATCH without phone preserves a concurrent phone update", async () => {
        const user = await mkUser("USER", "profile-phone-race");
        const agent = await login(user.email);
        const oldPhone = "+91 11111 11111";
        const newPhone = "+91 22222 22222";
        await q.exec("UPDATE users SET phone = ? WHERE id = ?", [oldPhone, user.id]);

        const lock = await q.pool.getConnection();
        let transactionOpen = false;
        try {
            await lock.beginTransaction();
            transactionOpen = true;
            await lock.execute("SELECT id FROM users WHERE id = ? FOR UPDATE", [user.id]);

            const patch = agent.patch("/api/v1/profile").set(H).send({ fullName: "Updated Profile Name" });
            // The request reads/updates while this transaction prevents its write from completing.
            await new Promise((resolve) => setTimeout(resolve, 100));
            await lock.execute("UPDATE users SET phone = ? WHERE id = ?", [newPhone, user.id]);
            await lock.commit();
            transactionOpen = false;

            const response = await patch.expect(200);
            expect(response.body.data.phone).toBe(newPhone);
            const [row] = await q.query("SELECT phone FROM users WHERE id = ?", [user.id]);
            expect(row.phone).toBe(newPhone);
        }
        finally {
            if (transactionOpen)
                await lock.rollback();
            lock.release();
        }
    });
    it("T4: user cannot read another user's complaint", async () => {
        const u1 = await login(U.user1.email), u2 = await login(U.user2.email);
        const c = await u1.post("/api/v1/complaints").set(H).send({ title: "Broken light", description: "Street light is broken", category: "LIGHTING" }).expect(201);
        await u1.get(`/api/v1/complaints/${c.body.data.id}`).expect(200);
        await u2.get(`/api/v1/complaints/${c.body.data.id}`).expect(404);
    });
    it("T5: revoked assignment preserves organization reads but removes booth assignment", async () => {
        const ag = await login(U.a1.email);
        await ag.get(`/api/v1/booth/households/${ids.houseA}`).expect(200);
        try {
            await q.exec("UPDATE booth_assignments SET revoked_at = NOW(3) WHERE user_id = ? AND booth_id = ? AND revoked_at IS NULL", [U.a1.id, ids.boothA]);
            // Household reads are organization-scoped; assignment revocation removes write/approval rights.
            await ag.get(`/api/v1/booth/households/${ids.houseA}`).expect(200);
            const profile = await ag.get("/api/v1/auth/me").expect(200);
            expect(profile.body.data.boothIds).not.toContain(ids.boothA);
        }
        finally {
            await q.exec("UPDATE booth_assignments SET revoked_at = NULL WHERE user_id = ? AND booth_id = ?", [U.a1.id, ids.boothA]);
        }
    });
    it("T7/T10: requester cannot approve own request; approval cannot be replayed", async () => {
        const a = await login(U.a1.email), b = await login(U.b1.email);
        const r = await a.post("/api/v1/cross-booth/requests").set(H).send({ sourceBoothId: ids.boothA, householdId: ids.houseB, reason: "Joint verification" }).expect(201);
        const id = r.body.data.id;
        await a.post(`/api/v1/cross-booth/requests/${id}/approve`).set(H).send({}).expect(403);
        await a.get(`/api/v1/booth/households/${ids.houseB}`).expect(200); // organization-scoped reads do not require a grant
        await a.get(`/api/v1/cross-booth/requests/${id}/household`).expect(404); // grant-specific roster remains unavailable
        await b.post(`/api/v1/cross-booth/requests/${id}/approve`).set(H).send({ grantHours: 1 }).expect(200);
        await b.post(`/api/v1/cross-booth/requests/${id}/approve`).set(H).send({ grantHours: 1 }).expect(409); // replay
        await a.get(`/api/v1/cross-booth/requests/${id}/household`).expect(200); // grant-specific roster is available after approval
    });
    it("decision rechecks current approver rights after a concurrent assignment revocation", async () => {
        const requester = await mkUser("BOOTH_MEMBER", "revocation-requester");
        await assign(ids.boothA, requester.id);
        const a = await login(requester.email);
        const created = await a.post("/api/v1/cross-booth/requests").set(H).send({
            sourceBoothId: ids.boothA, householdId: ids.houseB, reason: "Permission revocation regression",
        }).expect(201);
        const id = created.body.data.id;
        const staleContext = {
            user: {
                id: U.b1.id, role: "BOOTH_MEMBER", organizationId: ids.org,
                boothIds: [ids.boothB], approverBoothIds: [ids.boothB],
            },
            requestId: randomUUID(),
        };
        const [assignment] = await q.query("SELECT id FROM booth_assignments WHERE user_id = ? AND booth_id = ? AND revoked_at IS NULL", [U.b1.id, ids.boothB]);
        const crossBooth = await import("../src/services/crossBooth");
        try {
            await q.exec("UPDATE booth_assignments SET revoked_at = NOW(3) WHERE id = ?", [assignment.id]);
            await expect(crossBooth.approveRequest(staleContext, id, 1)).rejects.toMatchObject({ status: 403 });
            await expect(crossBooth.rejectRequest(staleContext, id)).rejects.toMatchObject({ status: 403 });

            await q.exec("UPDATE booth_assignments SET revoked_at = NULL, starts_at = DATE_ADD(NOW(3), INTERVAL 1 HOUR) WHERE id = ?", [assignment.id]);
            await expect(crossBooth.approveRequest(staleContext, id, 1)).rejects.toMatchObject({ status: 403 });

            await q.exec("UPDATE booth_assignments SET starts_at = DATE_SUB(NOW(3), INTERVAL 1 HOUR), ends_at = DATE_SUB(NOW(3), INTERVAL 1 MINUTE) WHERE id = ?", [assignment.id]);
            await expect(crossBooth.rejectRequest(staleContext, id)).rejects.toMatchObject({ status: 403 });

            await q.exec("UPDATE booth_assignments SET ends_at = NULL WHERE id = ?", [assignment.id]);
            await q.exec("UPDATE booths SET status = 'INACTIVE' WHERE id = ?", [ids.boothB]);
            await expect(crossBooth.approveRequest(staleContext, id, 1)).rejects.toMatchObject({ status: 403 });
        }
        finally {
            await q.exec("UPDATE booths SET status = 'ACTIVE' WHERE id = ?", [ids.boothB]);
            await q.exec("UPDATE booth_assignments SET revoked_at = NULL, starts_at = DATE_SUB(NOW(3), INTERVAL 1 HOUR), ends_at = NULL WHERE id = ?", [assignment.id]);
        }
        const [finalRow] = await q.query("SELECT status FROM cross_booth_requests WHERE id = ?", [id]);
        expect(finalRow.status).toBe("PENDING");
    });
    it("sensitive booth writes reject a stale context after assignment revocation", async () => {
        const member = await mkUser("BOOTH_MEMBER", "stale-write-member");
        await assign(ids.boothA, member.id);
        const context = {
            user: { id: member.id, role: "BOOTH_MEMBER", organizationId: ids.org,
                boothIds: [ids.boothA], approverBoothIds: [] },
            requestId: randomUUID(),
        };
        const [assignment] = await q.query("SELECT id FROM booth_assignments WHERE user_id = ? AND booth_id = ? AND revoked_at IS NULL", [member.id, ids.boothA]);
        const citizenId = randomUUID();
        await q.exec("INSERT INTO citizens (id, household_id, booth_id, full_name, relation, life_status) VALUES (?,?,?,?,?,?)",
            [citizenId, ids.houseA, ids.boothA, "Stale Assignment Resident", "MEMBER", "ALIVE"]);
        const crossBooth = await import("../src/services/crossBooth");
        const verification = await import("../src/services/verification");
        const households = await import("../src/repositories/households");

        await q.exec("UPDATE booth_assignments SET revoked_at = NOW(3) WHERE id = ?", [assignment.id]);
        await expect(crossBooth.createRequest(context, {
            sourceBoothId: ids.boothA, householdId: ids.houseB, action: "READ", reason: "Stale assignment check",
        })).rejects.toMatchObject({ status: 403 });
        await expect(verification.recordVerification(context, {
            citizenId, step: 1, result: "PASSED",
        })).rejects.toMatchObject({ status: 404 });
        await expect(households.updateVisitForUser(context, citizenId, {
            lifeStatus: "ALIVE", verificationDone: true, notHere: false, addressChanged: false,
            newAddress: "", visitNotes: "",
        })).rejects.toMatchObject({ status: 404 });
        const [written] = await q.query("SELECT COUNT(*) AS n FROM verifications WHERE citizen_id = ?", [citizenId]);
        expect(Number(written.n)).toBe(0);
    });
    it("sensitive booth writes reject future, expired, inactive, or suspended assignments", async () => {
        const member = await mkUser("BOOTH_MEMBER", "invalid-assignment-member");
        await assign(ids.boothA, member.id);
        const context = {
            user: { id: member.id, role: "BOOTH_MEMBER", organizationId: ids.org,
                boothIds: [ids.boothA], approverBoothIds: [] },
            requestId: randomUUID(),
        };
        const [assignment] = await q.query("SELECT id FROM booth_assignments WHERE user_id = ? AND booth_id = ? AND revoked_at IS NULL", [member.id, ids.boothA]);
        const citizenId = randomUUID();
        await q.exec("INSERT INTO citizens (id, household_id, booth_id, full_name, relation, life_status) VALUES (?,?,?,?,?,?)",
            [citizenId, ids.houseA, ids.boothA, "Invalid Assignment Resident", "MEMBER", "ALIVE"]);
        const crossBooth = await import("../src/services/crossBooth");
        const verification = await import("../src/services/verification");
        const households = await import("../src/repositories/households");
        try {
            await q.exec("UPDATE booth_assignments SET starts_at = DATE_ADD(NOW(3), INTERVAL 1 HOUR) WHERE id = ?", [assignment.id]);
            await expect(crossBooth.createRequest(context, {
                sourceBoothId: ids.boothA, householdId: ids.houseB, action: "READ", reason: "Future assignment check",
            })).rejects.toMatchObject({ status: 403 });

            await q.exec("UPDATE booth_assignments SET starts_at = DATE_SUB(NOW(3), INTERVAL 1 HOUR), ends_at = DATE_SUB(NOW(3), INTERVAL 1 MINUTE) WHERE id = ?", [assignment.id]);
            await expect(households.updateVisitForUser(context, citizenId, {
                lifeStatus: "ALIVE", verificationDone: true, notHere: false, addressChanged: false,
                newAddress: "", visitNotes: "",
            })).rejects.toMatchObject({ status: 404 });

            await q.exec("UPDATE booth_assignments SET ends_at = NULL WHERE id = ?", [assignment.id]);
            await q.exec("UPDATE booths SET status = 'INACTIVE' WHERE id = ?", [ids.boothA]);
            await expect(verification.recordVerification(context, {
                citizenId, step: 1, result: "PASSED",
            })).rejects.toMatchObject({ status: 404 });
            await q.exec("UPDATE booths SET status = 'ACTIVE' WHERE id = ?", [ids.boothA]);
            await q.exec("UPDATE users SET status = 'SUSPENDED' WHERE id = ?", [member.id]);
            await expect(households.updateVisitForUser(context, citizenId, {
                lifeStatus: "ALIVE", verificationDone: true, notHere: false, addressChanged: false,
                newAddress: "", visitNotes: "",
            })).rejects.toMatchObject({ status: 404 });
        }
        finally {
            await q.exec("UPDATE booths SET status = 'ACTIVE' WHERE id = ?", [ids.boothA]);
            await q.exec("UPDATE users SET status = 'ACTIVE' WHERE id = ?", [member.id]);
            await q.exec("UPDATE booth_assignments SET revoked_at = NULL, starts_at = DATE_SUB(NOW(3), INTERVAL 1 HOUR), ends_at = NULL WHERE id = ?", [assignment.id]);
        }
    });
    it("serializes concurrent attachment uploads and keeps the complaint limit", async () => {
        const owner = await mkUser("USER", "attachment-owner");
        const agent = await login(owner.email);
        const created = await agent.post("/api/v1/complaints").set(H).send({
            title: "Attachment race", description: "Synthetic complaint for concurrent upload testing", category: "OTHER",
        }).expect(201);
        const complaintId = created.body.data.id;
        const image = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]);
        const upload = () => agent.post(`/api/v1/complaints/${complaintId}/attachments`)
            .set(H).set("Content-Type", "image/jpeg").send(image);
        try {
            await upload().expect(201);
            await upload().expect(201);
            const results = await Promise.all([upload(), upload()]);
            expect(results.map((response) => response.status).sort()).toEqual([201, 409]);
            const [count] = await q.query("SELECT COUNT(*) AS n FROM attachments WHERE complaint_id = ?", [complaintId]);
            expect(Number(count.n)).toBe(3);
            expect(await fs.readdir(uploadDir)).toHaveLength(3);
        }
        finally {
            const rows = await q.query("SELECT object_key FROM attachments WHERE complaint_id = ?", [complaintId]);
            await q.exec("DELETE FROM attachments WHERE complaint_id = ?", [complaintId]);
            await q.exec("UPDATE complaints SET attachment_count = 0 WHERE id = ?", [complaintId]);
            await Promise.all(rows.map((row) => fs.unlink(path.join(uploadDir, path.basename(row.object_key))).catch(() => undefined)));
        }
    });
    it("marks an import failed when a voter ID becomes duplicate after preview", async () => {
        const workerDb = await import("../../worker/src/db.js");
        const workerJobs = await import("../../worker/src/jobs.js");
        const citizenId = randomUUID();
        const voterId = `LATE${randomUUID().replace(/-/g, "").slice(0, 12)}`;
        const jobId = randomUUID();
        const houseCode = `IM-${randomUUID().slice(0, 8)}`;
        try {
            const [booth] = await q.query("SELECT code FROM booths WHERE id = ?", [ids.boothA]);
            await q.exec("INSERT INTO citizens (id, household_id, booth_id, full_name, relation, voter_id, life_status) VALUES (?,?,?,?,?,?,?)",
                [citizenId, ids.houseA, ids.boothA, "Existing Synthetic Person", "RESIDENT", voterId, "UNKNOWN"]);
            const payload = [{
                boothId: ids.boothA, boothCode: booth.code, houseCode, addressLine: null, rollSerial: null,
                fullName: "Late Duplicate Synthetic Person", relation: "RESIDENT", voterId, age: null,
                gender: "UNKNOWN", lifeStatus: "UNKNOWN", verificationDone: false, notHere: false,
                addressChanged: false, newAddress: null, visitNotes: null,
            }];
            await q.exec(`INSERT INTO import_jobs (id, organization_id, created_by, status, total_rows, valid_rows, payload, data_tracked)
                VALUES (?, ?, ?, 'QUEUED', 1, 1, ?, 1)`, [jobId, ids.org, U.a1.id, JSON.stringify(payload)]);

            await expect(workerJobs.processImports()).resolves.toBe(1);

            const [job] = await q.query("SELECT status, processed_rows AS processedRows, last_error AS lastError FROM import_jobs WHERE id = ?", [jobId]);
            expect(job.status).toBe("FAILED");
            expect(Number(job.processedRows)).toBe(0);
            expect(job.lastError).toContain("conflicted with data saved after preview");
            expect(job.lastError).not.toContain(voterId);
            const [imported] = await q.query("SELECT COUNT(*) AS n FROM citizens WHERE source_import_job_id = ?", [jobId]);
            expect(Number(imported.n)).toBe(0);
        }
        finally {
            await q.exec("DELETE FROM citizens WHERE id = ? OR source_import_job_id = ?", [citizenId, jobId]);
            await q.exec("DELETE FROM households WHERE booth_id = ? AND house_code = ? AND NOT EXISTS (SELECT 1 FROM citizens WHERE citizens.household_id = households.id)", [ids.boothA, houseCode]);
            await q.exec("DELETE FROM import_jobs WHERE id = ?", [jobId]);
            await workerDb.pool.end();
        }
    });
    it("rejects sequential duplicate requests and permits a new request after rejection", async () => {
        const requester = await mkUser("BOOTH_MEMBER", "duplicate-sequential");
        await assign(ids.boothA, requester.id);
        const agent = await login(requester.email);
        const payload = { sourceBoothId: ids.boothA, householdId: ids.houseB, reason: "Sequential duplicate regression" };

        const first = await agent.post("/api/v1/cross-booth/requests").set(H).send(payload).expect(201);
        const duplicate = await agent.post("/api/v1/cross-booth/requests").set(H).send(payload).expect(409);
        expect(duplicate.body.error).toMatchObject({ code: "CONFLICT", message: "A pending request already exists" });

        await q.exec("UPDATE cross_booth_requests SET status = 'REJECTED' WHERE id = ?", [first.body.data.id]);
        const afterRejected = await agent.post("/api/v1/cross-booth/requests").set(H).send(payload).expect(201);

        await q.exec("UPDATE cross_booth_requests SET status = 'EXPIRED' WHERE id = ?", [afterRejected.body.data.id]);
        const afterExpired = await agent.post("/api/v1/cross-booth/requests").set(H).send(payload).expect(201);

        await q.exec("UPDATE cross_booth_requests SET status = 'APPROVED', grant_expires_at = DATE_SUB(NOW(3), INTERVAL 1 MINUTE) WHERE id = ?", [afterExpired.body.data.id]);
        await agent.post("/api/v1/cross-booth/requests").set(H).send(payload).expect(201);
    });
    it("serializes concurrent duplicate requests and returns one conflict", async () => {
        const requester = await mkUser("BOOTH_MEMBER", "duplicate-concurrent");
        await assign(ids.boothA, requester.id);
        const agent = await login(requester.email);
        const payload = { sourceBoothId: ids.boothA, householdId: ids.houseB, reason: "Concurrent duplicate regression" };

        const responses = await Promise.all([
            agent.post("/api/v1/cross-booth/requests").set(H).send(payload),
            agent.post("/api/v1/cross-booth/requests").set(H).send(payload),
        ]);
        expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
        const duplicate = responses.find((response) => response.status === 409);
        expect(duplicate.body.error).toMatchObject({ code: "CONFLICT", message: "A pending request already exists" });
    });
    it("expired cross-booth requests stay expired and cannot be approved or rejected", async () => {
        const requester = await mkUser("BOOTH_MEMBER", "expiry-requester");
        await assign(ids.boothA, requester.id);
        const a = await login(requester.email), b = await login(U.b1.email);
        const created = await a.post("/api/v1/cross-booth/requests").set(H).send({
            sourceBoothId: ids.boothA, householdId: ids.houseB, reason: "Expired request regression",
        }).expect(201);
        const id = created.body.data.id;
        await q.exec("UPDATE cross_booth_requests SET expires_at = DATE_SUB(NOW(3), INTERVAL 1 MINUTE) WHERE id = ?", [id]);

        await b.post(`/api/v1/cross-booth/requests/${id}/approve`).set(H).send({}).expect(409);
        let [row] = await q.query("SELECT status FROM cross_booth_requests WHERE id = ?", [id]);
        expect(row.status).toBe("EXPIRED");

        await b.post(`/api/v1/cross-booth/requests/${id}/reject`).set(H).send({}).expect(409);
        [row] = await q.query("SELECT status FROM cross_booth_requests WHERE id = ?", [id]);
        expect(row.status).toBe("EXPIRED");
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
        expect(roster.body.data.citizens[0].voterId).toBe("****2345");
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
    it("T6: expired grant cannot expose its roster while organization household reads remain available", async () => {
        const a = await login(U.a1.email);
        await q.exec("UPDATE cross_booth_requests SET grant_expires_at = DATE_SUB(NOW(3), INTERVAL 1 MINUTE) WHERE requester_id = ?", [U.a1.id]);
        const [grant] = await q.query("SELECT id FROM cross_booth_requests WHERE requester_id = ? AND action = 'VERIFY' AND status = 'APPROVED' ORDER BY created_at DESC LIMIT 1", [U.a1.id]);
        expect(grant).toBeDefined();
        await a.get(`/api/v1/cross-booth/requests/${grant.id}/household`).expect(404);
        await a.get(`/api/v1/booth/households/${ids.houseB}`).expect(200);
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
