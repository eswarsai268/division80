import "./syntheticBackendEnv.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const db = require("../src/db/pool.js");
import { listCitizensForUser } from "../src/repositories/households.js";

afterEach(() => vi.restoreAllMocks());

describe("household WhatsApp links", () => {
  it("returns a normalized chat number only for a caller's assigned booth", async () => {
    vi.spyOn(db, "query")
      .mockResolvedValueOnce([{ id: "house-1", boothId: "booth-1", boothCode: "1", houseCode: "42" }])
      .mockResolvedValueOnce([{
        id: "citizen-1",
        fullName: "Person",
        voterId: "VOTER1234",
        phone: "9876543210",
        passedSteps: "0",
      }]);

    const result = await listCitizensForUser({
      role: "BOOTH_MEMBER",
      organizationId: "org-1",
      boothIds: ["booth-1"],
    }, "house-1");

    expect(result.citizens[0]).toMatchObject({ whatsappPhone: "919876543210", voterId: "VOTER1234" });
    expect(result.citizens[0]).not.toHaveProperty("phone");
  });

  it("does not return a phone link for a booth outside the caller's assignments", async () => {
    vi.spyOn(db, "query")
      .mockResolvedValueOnce([{ id: "house-1", boothId: "booth-1", boothCode: "1", houseCode: "42" }])
      .mockResolvedValueOnce([{
        id: "citizen-1",
        fullName: "Person",
        voterId: "VOTER1234",
        phone: "9876543210",
        passedSteps: "0",
      }]);

    const result = await listCitizensForUser({
      role: "BOOTH_MEMBER",
      organizationId: "org-1",
      boothIds: [],
    }, "house-1");

    expect(result.citizens[0]).toMatchObject({ whatsappPhone: null, voterId: "****1234" });
    expect(result.citizens[0]).not.toHaveProperty("phone");
  });
});
