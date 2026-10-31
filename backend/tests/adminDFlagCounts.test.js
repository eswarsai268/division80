import { createRequire } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV ??= "test";
process.env.DATABASE_HOST ??= "127.0.0.1";
process.env.DATABASE_USER ??= "synthetic-test-user";
process.env.JWT_ACCESS_SECRET ??= "a".repeat(40);

const require = createRequire(import.meta.url);
const database = require("../src/db/pool.js");
const { listDFlagCountsByMember } = require("../src/services/admin2.js");
const execute = vi.spyOn(database.pool, "execute");

describe("D flag counts by member", () => {
    beforeEach(() => {
        execute.mockReset();
    });

    it("returns distinct currently checked D record counts per organization member", async () => {
        execute.mockResolvedValueOnce([[
            { memberId: "member-1", fullName: "Member One", dCount: "4" },
            { memberId: "member-2", fullName: "Member Two", dCount: "0" },
        ], []]);

        const result = await listDFlagCountsByMember({
            user: { organizationId: "organization-id" },
        }, { limit: 50 });

        expect(result).toEqual({
            items: [
                { memberId: "member-1", fullName: "Member One", dCount: 4 },
                { memberId: "member-2", fullName: "Member Two", dCount: 0 },
            ],
            nextCursor: null,
        });
        const [memberCountsSql, memberParams] = execute.mock.calls[0];
        expect(memberCountsSql.sql).toContain("b.organization_id = ?");
        expect(memberCountsSql.sql).toContain("COUNT(DISTINCT ci.id)");
        expect(memberCountsSql.sql).toContain("ci.d_flag = 1");
        expect(memberCountsSql.sql).toContain("ci.deleted_at IS NULL");
        expect(memberCountsSql.sql).toContain("ci.d_completed_by IS NOT NULL");
        expect(memberCountsSql.sql).toContain("u.role = 'BOOTH_MEMBER'");
        expect(memberParams).toEqual(["organization-id", "organization-id"]);
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it("paginates through all booth members by ID", async () => {
        execute.mockResolvedValueOnce([[
            { memberId: "member-2", fullName: "Member Two", dCount: "1" },
            { memberId: "member-3", fullName: "Member Three", dCount: "0" },
            { memberId: "member-4", fullName: "Member Four", dCount: "2" },
        ], []]);

        const result = await listDFlagCountsByMember({
            user: { organizationId: "organization-id" },
        }, { limit: 2, cursor: "member-1" });

        expect(result).toEqual({
            items: [
                { memberId: "member-2", fullName: "Member Two", dCount: 1 },
                { memberId: "member-3", fullName: "Member Three", dCount: 0 },
            ],
            nextCursor: "member-3",
        });
        const [statement, params] = execute.mock.calls[0];
        expect(statement.sql).toContain("u.id > ?");
        expect(params).toEqual(["organization-id", "organization-id", "member-1"]);
        expect(execute).toHaveBeenCalledTimes(1);
    });
});
