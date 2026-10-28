import "./syntheticBackendEnv.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const db = require("../src/db/pool.js");
import { deleteImportJob } from "../src/services/importExport.js";
import { getOfflineRosterRevisionForUser } from "../src/repositories/households.js";

const context = { user: { organizationId: "org-1" } };
const jobId = "job-1";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("import deletion", () => {
  it("permanently removes imported records and dependent booth data in one transaction", async () => {
    const connection = {};
    vi.spyOn(db, "tx").mockImplementation(async (work) => work(connection));
    const query = vi.spyOn(db, "query")
      .mockResolvedValueOnce([{ status: "COMMITTED", dataTracked: 1 }])
      .mockResolvedValueOnce([
        { tableName: "import_phone_contacts" },
        { tableName: "whatsapp_campaign_jobs" },
        { tableName: "whatsapp_campaign_recipients" },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "booth-1" }])
      .mockResolvedValueOnce([{ id: "house-1" }])
      .mockResolvedValueOnce([{ id: "booth-1" }]);
    vi.spyOn(db, "exec").mockResolvedValue({ affectedRows: 1 });

    await expect(deleteImportJob(context, jobId)).resolves.toEqual({ id: jobId, deleted: true });

    const exec = db.exec;
    expect(exec).toHaveBeenCalledTimes(11);
    expect(exec.mock.calls.map(([sql]) => sql)).toEqual(expect.arrayContaining([
      expect.stringContaining("DELETE FROM verifications"),
      expect.stringContaining("DELETE FROM citizens WHERE source_import_job_id = ?"),
      expect.stringContaining("DELETE FROM households h"),
      expect.stringContaining("UPDATE households h SET"),
      expect.stringContaining("UPDATE booths b SET source_import_job_id = CASE"),
      expect.stringContaining("DELETE FROM booth_assignments"),
      expect.stringContaining("UPDATE export_jobs SET status = 'EXPIRED', content = NULL"),
      expect.stringContaining("DELETE FROM booths WHERE organization_id = ?"),
    ]));
    expect(exec.mock.calls.every(([, , conn]) => conn === connection)).toBe(true);
    expect(exec.mock.calls[0][0]).toContain("DELETE FROM import_phone_contacts");
    expect(exec.mock.calls[0][1]).toEqual([jobId, context.user.organizationId]);
    expect(exec.mock.calls[3][0]).toContain("NOT EXISTS (SELECT 1 FROM citizens ci WHERE ci.household_id = h.id)");
    expect(query.mock.calls[3][0]).toContain("h.source_import_job_id = ?");
    expect(query.mock.calls[4][0]).toContain("h.address_source_import_job_id = ?");
    expect(query.mock.calls[5][0]).toContain("NOT EXISTS (SELECT 1 FROM households h WHERE h.booth_id = b.id)");
    expect(exec.mock.calls[4][0]).toContain("verification_status = CASE");
    expect(exec.mock.calls[4][0]).toContain("source_import_job_id = IF(h.source_import_job_id = ?, NULL, h.source_import_job_id)");
    expect(exec.mock.calls[4][0]).toContain("address_line = IF(h.address_source_import_job_id = ?, NULL, h.address_line)");
  });

  it("purges linked campaign recipients and recalculates or removes campaign summaries", async () => {
    vi.spyOn(db, "tx").mockImplementation(async (work) => work({}));
    const query = vi.spyOn(db, "query")
      .mockResolvedValueOnce([{ status: "COMMITTED", dataTracked: 1 }])
      .mockResolvedValueOnce([
        { tableName: "import_phone_contacts" },
        { tableName: "whatsapp_campaign_jobs" },
        { tableName: "whatsapp_campaign_recipients" },
      ])
      .mockResolvedValueOnce([{ jobId: "campaign-1" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const exec = vi.spyOn(db, "exec").mockResolvedValue({ affectedRows: 1 });

    await deleteImportJob(context, jobId);

    expect(exec.mock.calls[0][0]).toContain("DELETE r FROM whatsapp_campaign_recipients r");
    expect(exec.mock.calls[1][0]).toContain("recipient_count = (SELECT COUNT(*)");
    expect(exec.mock.calls[1][0]).toContain("invalid_phone_count = 0");
    expect(exec.mock.calls[2][0]).toContain("DELETE j FROM whatsapp_campaign_jobs j");
    expect(exec.mock.calls[3][0]).toContain("DELETE FROM import_phone_contacts");
    expect(query).toHaveBeenCalled();
  });

  it("still deletes tracked roster data when optional WhatsApp migrations are absent", async () => {
    vi.spyOn(db, "tx").mockImplementation(async (work) => work({}));
    vi.spyOn(db, "query")
      .mockResolvedValueOnce([{ status: "COMMITTED", dataTracked: 1 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const exec = vi.spyOn(db, "exec").mockResolvedValue({ affectedRows: 1 });

    await expect(deleteImportJob(context, jobId)).resolves.toEqual({ id: jobId, deleted: true });

    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM citizens WHERE source_import_job_id = ?"),
      [jobId],
      expect.any(Object),
    );
    expect(exec.mock.calls.some(([sql]) => sql.includes("whatsapp_campaign_"))).toBe(false);
    expect(exec.mock.calls.some(([sql]) => sql.includes("import_phone_contacts"))).toBe(false);
  });

  it("refuses to purge a legacy committed import without source tracking", async () => {
    vi.spyOn(db, "tx").mockImplementation(async (work) => work({}));
    vi.spyOn(db, "query").mockResolvedValueOnce([{ status: "COMMITTED", dataTracked: 0 }]);
    const exec = vi.spyOn(db, "exec");

    await expect(deleteImportJob(context, jobId)).rejects.toMatchObject({ code: "IMPORT_NOT_TRACKED" });
    expect(exec).not.toHaveBeenCalled();
  });

  it("removes a preview job without touching roster records", async () => {
    vi.spyOn(db, "tx").mockImplementation(async (work) => work({}));
    vi.spyOn(db, "query").mockResolvedValueOnce([{ status: "PREVIEW", dataTracked: 0 }]);
    const exec = vi.spyOn(db, "exec").mockResolvedValue({ affectedRows: 1 });

    await expect(deleteImportJob(context, jobId)).resolves.toEqual({ id: jobId, deleted: true });
    expect(exec).toHaveBeenCalledOnce();
    expect(exec.mock.calls[0][0]).toContain("UPDATE import_jobs SET deleted_at");
  });
});

describe("offline roster revision", () => {
  it("scopes deleted-import revision checks to the caller's organization", async () => {
    vi.spyOn(db, "query").mockResolvedValueOnce([{ revision: "1:20261027120000000000" }]);

    await expect(getOfflineRosterRevisionForUser({ role: "BOOTH_MEMBER", organizationId: "org-1" }))
      .resolves.toEqual({ revision: "1:20261027120000000000" });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain("FROM import_jobs j WHERE j.organization_id = ? AND j.deleted_at IS NOT NULL");
    expect(params).toEqual(Array(7).fill("org-1"));
  });

  it("does not expose revision checks to non-booth roles", async () => {
    const query = vi.spyOn(db, "query");
    await expect(getOfflineRosterRevisionForUser({ role: "ADMIN", organizationId: "org-1" }))
      .rejects.toMatchObject({ status: 403 });
    expect(query).not.toHaveBeenCalled();
  });
});
