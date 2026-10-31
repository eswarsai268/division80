// Requires a migrated TEST database. Run only against an isolated synthetic test database.
import { randomUUID } from "crypto";
import request from "supertest";
import { describe, expect, it, beforeAll } from "vitest";
import { isAuthzDatabaseTestEnabled } from "./authzTestGate.mjs";
const enabled = isAuthzDatabaseTestEnabled(process.env);
process.env.JWT_ACCESS_SECRET ??= "t".repeat(40);

describe.skipIf(!enabled)("authorization and retired routes", () => {
  let app, q, hash;
  const H = { "X-Requested-With": "samasya-web" };
  const pw = "Correct-Horse-Battery-9";
  const ids = {};
  const users = {};
  const login = async (email) => {
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").set(H).send({ email, password: pw }).expect(200);
    return agent;
  };
  async function mkUser(role, label) {
    const id = randomUUID();
    const email = `${label}-${id.slice(0, 8)}@test.local`;
    await q.exec("INSERT INTO users (id, organization_id, email, password_hash, full_name, role) VALUES (?,?,?,?,?,?)", [id, ids.org, email, await hash(pw), label, role]);
    return { id, email };
  }

  beforeAll(async () => {
    ids.org = randomUUID();
    process.env.DEFAULT_ORG_SLUG = `test-${ids.org.slice(0, 8)}`;
    app = (await import("../src/app")).createApp();
    q = await import("../src/db/pool");
    hash = (await import("../src/auth/password")).hashPassword;
    await q.exec("INSERT INTO organizations (id, slug, name) VALUES (?,?,?)", [ids.org, process.env.DEFAULT_ORG_SLUG, "Synthetic test"]);
    for (const suffix of ["A", "B"]) {
      ids[`booth${suffix}`] = randomUUID();
      ids[`house${suffix}`] = randomUUID();
      ids[`citizen${suffix}`] = randomUUID();
      ids[`voterId${suffix}`] = `TEST${ids[`citizen${suffix}`].replace(/-/g, "").slice(0, 8)}`;
      await q.exec("INSERT INTO booths (id, organization_id, code, name) VALUES (?,?,?,?)", [ids[`booth${suffix}`], ids.org, suffix + ids[`booth${suffix}`].slice(0, 5), `Booth ${suffix}`]);
      await q.exec("INSERT INTO households (id, organization_id, booth_id, house_code) VALUES (?,?,?,?)", [ids[`house${suffix}`], ids.org, ids[`booth${suffix}`], `HOUSE-${suffix}`]);
      await q.exec("INSERT INTO citizens (id, household_id, booth_id, full_name, father_or_husband_name, relation, voter_id, life_status, roll_serial, polling_station) VALUES (?,?,?,?,?,?,?,?,?,?)", [ids[`citizen${suffix}`], ids[`house${suffix}`], ids[`booth${suffix}`], `Resident ${suffix}`, `Parent ${suffix}`, "MEMBER", ids[`voterId${suffix}`], "ALIVE", `857${suffix === "A" ? "5" : "6"}`, `Station ${suffix}`]);
    }
    users.a = await mkUser("BOOTH_MEMBER", "member-a");
    users.b = await mkUser("BOOTH_MEMBER", "member-b");
    users.admin = await mkUser("ADMIN", "admin");
    await q.exec("INSERT INTO booth_assignments (id, booth_id, user_id, created_by) VALUES (?,?,?,?)", [randomUUID(), ids.boothA, users.a.id, users.admin.id]);
    await q.exec("INSERT INTO booth_assignments (id, booth_id, user_id, created_by) VALUES (?,?,?,?)", [randomUUID(), ids.boothB, users.b.id, users.admin.id]);
  });

  it("booth members can view houses and people across their organization", async () => {
    const agent = await login(users.a.email);
    const list = await agent.get("/api/v1/booth/households").expect(200);
    expect(list.body.data.items.map((x) => x.id)).toContain(ids.houseB);
    const detail = await agent.get(`/api/v1/booth/households/${ids.houseB}/citizens`).expect(200);
    expect(detail.body.data.citizens[0].fullName).toBe("Resident B");
    expect(detail.body.data.citizens[0].voterId).toMatch(/^\*\*\*\*/);
    expect(detail.body.data.household.ownBooth).toBe(false);
  });

  it("search results include record details while masking cross-booth voter IDs", async () => {
    const agent = await login(users.a.email);
    const response = await agent.get("/api/v1/booth/households?search=8576").expect(200);
    const house = response.body.data.items.find((item) => item.id === ids.houseB);
    expect(house.matchingCitizens[0]).toMatchObject({
      fullName: "Resident B",
      fatherOrHusbandName: "Parent B",
      rollSerial: "8576",
      voterId: `****${ids.voterIdB.slice(-4)}`,
      pollingStation: "Station B",
    });
    const houseSearch = await agent.get("/api/v1/booth/households?search=HOUSE-B").expect(200);
    const houseRecord = houseSearch.body.data.items.find((item) => item.id === ids.houseB);
    expect(houseRecord.searchRecords[0].fullName).toBe("Resident B");
    expect(houseRecord.searchRecords[0].voterId).toBe(`****${ids.voterIdB.slice(-4)}`);
  });

  it("supports serial-only lookup without matching names, voter IDs, or house codes", async () => {
    const agent = await login(users.a.email);
    const serial = await agent.get("/api/v1/booth/households?search=8576&searchField=serial").expect(200);
    expect(serial.body.data.items.map((item) => item.id)).toEqual([ids.houseB]);
    expect(serial.body.data.items[0].searchRecords.map((record) => record.rollSerial)).toEqual(["8576"]);

    for (const search of ["Resident B", ids.voterIdB, "HOUSE-B"]) {
      const response = await agent.get(`/api/v1/booth/households?search=${encodeURIComponent(search)}&searchField=serial`).expect(200);
      expect(response.body.data.items).toHaveLength(0);
    }

    const generalSearch = await agent.get("/api/v1/booth/households?search=Resident%20B").expect(200);
    expect(generalSearch.body.data.items.map((item) => item.id)).toContain(ids.houseB);
  });

  it("extends the session lifetime when rotating a refresh token", async () => {
    const user = await mkUser("BOOTH_MEMBER", "refresh");
    const agent = await login(user.email);
    const session = (await q.query("SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", [user.id]))[0];
    await q.exec("UPDATE sessions SET expires_at = DATE_ADD(NOW(3), INTERVAL 1 DAY) WHERE id = ?", [session.id]);

    await agent.post("/api/v1/auth/refresh").set(H).expect(200);

    const [result] = await q.query("SELECT expires_at > DATE_ADD(NOW(3), INTERVAL 29 DAY) AS renewed FROM sessions WHERE id = ?", [session.id]);
    expect(Boolean(result.renewed)).toBe(true);
  });

  it("booth assignment still limits door-to-door visit writes", async () => {
    const agent = await login(users.a.email);
    await agent.patch(`/api/v1/booth/citizens/${ids.citizenB}/visit`).set(H).send({
      lifeStatus: "ALIVE", verificationDone: true, notHere: false, addressChanged: false, newAddress: "", visitNotes: "",
    }).expect(404);
  });

  it("removes cross-booth approval and keeps verification writes and history assigned-booth scoped", async () => {
    const agentA = await login(users.a.email);
    await agentA.post("/api/v1/cross-booth/requests").set(H).send({}).expect(404);
    await agentA.post("/api/v1/booth/verifications").set(H).send({ citizenId: ids.citizenB, step: 1, result: "PASSED" }).expect(404);
    const resultA = await agentA.post("/api/v1/booth/verifications").set(H).send({ citizenId: ids.citizenA, step: 1, result: "PASSED" }).expect(201);
    const listA = await agentA.get("/api/v1/booth/verifications").expect(200);
    expect(listA.body.data.some((v) => v.citizenName === "Resident A")).toBe(true);
    expect(listA.body.data.some((v) => v.citizenName === "Resident B")).toBe(false);
    await agentA.get(`/api/v1/booth/verifications/${resultA.body.data.id}`).expect(200);

    const agentB = await login(users.b.email);
    const resultB = await agentB.post("/api/v1/booth/verifications").set(H).send({ citizenId: ids.citizenB, step: 1, result: "PASSED" }).expect(201);
    await agentA.get(`/api/v1/booth/verifications/${resultB.body.data.id}`).expect(404);
  });

  it("citizen account, complaint, audit, and cross-booth APIs are absent", async () => {
    const agent = await login(users.a.email);
    await request(app).post("/api/v1/auth/register").set(H).send({}).expect(404);
    await agent.get("/api/v1/profile").expect(404);
    await agent.post("/api/v1/complaints").set(H).send({}).expect(404);
    const admin = await login(users.admin.email);
    await admin.get("/api/v1/admin/audit-logs").expect(404);
    await admin.get("/api/v1/admin/cross-booth").expect(404);
    await admin.post("/api/v1/admin/users").set(H).send({ email: "citizen@test.local", fullName: "Citizen", password: pw, role: "USER" }).expect(422);
  });

  it("organization reads do not cross tenant boundaries", async () => {
    const agent = await login(users.a.email);
    const otherOrg = randomUUID(), booth = randomUUID(), house = randomUUID();
    await q.exec("INSERT INTO organizations (id, slug, name) VALUES (?,?,?)", [otherOrg, `other-${otherOrg.slice(0, 8)}`, "Other synthetic org"]);
    await q.exec("INSERT INTO booths (id, organization_id, code, name) VALUES (?,?,?,?)", [booth, otherOrg, "OTHER", "Other booth"]);
    await q.exec("INSERT INTO households (id, organization_id, booth_id, house_code) VALUES (?,?,?,?)", [house, otherOrg, booth, "OTHER-HOUSE"]);
    await agent.get(`/api/v1/booth/households/${house}`).expect(404);
  });
});
