import "./syntheticBackendEnv.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const db = require("../src/db/pool.js");
import { createImportJob } from "../src/services/importExport.js";

afterEach(() => vi.restoreAllMocks());

describe("import-owned phone contacts", () => {
  it("keeps numbers independent of duplicate voter IDs and invalid roster phone fields", async () => {
    vi.spyOn(db, "query")
      .mockResolvedValueOnce([{ id: "booth-1", code: "1", status: "ACTIVE" }])
      .mockResolvedValueOnce([{ id: "citizen-1", voter_id: "DUP1" }]);
    const exec = vi.spyOn(db, "exec").mockResolvedValue({ affectedRows: 1 });
    const csv = [
      "booth_code,house_code,full_name,voter_id,phone,gender",
      "1,10,Existing, DUP1 ,+91 98765 43210,MALE",
      "1,11,Repeated,DUP1,9876543211,FEMALE",
      "1,12,New,VOTER2,invalid-number,UNKNOWN",
      "1,13,Blank phone,VOTER3,,UNKNOWN",
      "1,14,Duplicate phone,VOTER4,+919876543210,UNKNOWN",
    ].join("\n");

    const preview = await createImportJob({ user: { id: "admin-1", organizationId: "org-1" } }, csv);

    expect(preview).toMatchObject({ rosterRows: 3, phoneRows: 2, invalidPhoneRows: 2, skippedRows: 2, validRows: 5 });
    const payload = JSON.parse(exec.mock.calls[0][1][8]);
    expect(payload.records).toHaveLength(3);
    expect(payload.records[0]).not.toHaveProperty("phone");
    expect(payload.records[0]).not.toHaveProperty("whatsappOptIn");
    expect(payload.phoneContacts.map(({ phone }) => phone)).toEqual(["+919876543210", "9876543211"]);
    expect(payload.phoneContacts.every((contact) => Object.keys(contact).length === 1)).toBe(true);
  });
});
