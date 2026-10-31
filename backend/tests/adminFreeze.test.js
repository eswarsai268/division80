import { createRequire } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV ??= "test";
process.env.DATABASE_HOST ??= "127.0.0.1";
process.env.DATABASE_USER ??= "synthetic-test-user";
process.env.JWT_ACCESS_SECRET ??= "a".repeat(40);

const require = createRequire(import.meta.url);
const database = require("../src/db/pool.js");
const { freezeAllDFlagPeople } = require("../src/services/admin2.js");
const execute = vi.spyOn(database.pool, "execute");

describe("freeze all D-completed records", () => {
    beforeEach(() => {
        execute.mockReset();
    });

    it("freezes only pending D-completed records in the current organization", async () => {
        execute.mockResolvedValue([{ affectedRows: 3 }, []]);

        const result = await freezeAllDFlagPeople({
            user: { id: "admin-id", organizationId: "organization-id" },
        });

        expect(result).toEqual({ frozenCount: 3 });
        const [statement, params] = execute.mock.calls[0];
        const sql = statement.sql;
        expect(sql).toContain("JOIN booths b ON b.id = ci.booth_id");
        expect(sql).toContain("b.organization_id = ?");
        expect(sql).toContain("ci.deleted_at IS NULL");
        expect(sql).toContain("ci.d_flag = 1");
        expect(sql).toContain("ci.is_frozen = 0");
        expect(params).toEqual(["admin-id", "organization-id"]);
    });
});
