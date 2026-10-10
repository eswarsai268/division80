import { beforeAll, describe, expect, it } from "vitest";
beforeAll(() => {
    process.env.DATABASE_HOST ??= "x";
    process.env.DATABASE_USER ??= "x";
    process.env.JWT_ACCESS_SECRET ??= "a".repeat(40);
});
describe("verification step ordering", () => {
    it("enforces strict order", async () => {
        const { nextStep } = await import("../src/services/verification");
        expect(nextStep([])).toBe(1);
        expect(nextStep([1, 2])).toBe(3);
        expect(nextStep([1, 3])).toBe(2);
        expect(nextStep([1, 2, 3, 4, 5, 6])).toBeNull();
    });
});
describe("masking", () => {
    it("masks voter id", async () => {
        const { maskVoter } = await import("../src/repositories/households");
        expect(maskVoter("ABC1234567")).toBe("****4567");
        expect(maskVoter(null)).toBeNull();
    });
});
describe("csrf guard", () => {
    const run = async (method, headers) => {
        const { csrfGuard } = await import("../src/middleware/security");
        let err;
        csrfGuard({ method, headers }, {}, (e) => { err = e; });
        return err;
    };
    it("allows GET", async () => expect(await run("GET", {})).toBeUndefined());
    it("rejects POST without header", async () => expect((await run("POST", {}))?.status).toBe(403));
    it("accepts POST with header", async () => expect(await run("POST", { "x-requested-with": "samasya-web" })).toBeUndefined());
    it("rejects foreign origin", async () => expect((await run("POST", { "x-requested-with": "samasya-web", origin: "https://evil.example" }))?.status).toBe(403));
});
describe("tokens", () => {
    it("rejects a forged / wrong-secret JWT", async () => {
        const { verifyAccess } = await import("../src/auth/tokens");
        const jwt = (await import("jsonwebtoken")).default;
        expect(verifyAccess(jwt.sign({ sub: "u", sid: "s" }, "z".repeat(40)))).toBeNull();
        expect(verifyAccess(jwt.sign({ sub: "u", sid: "s" }, "", { algorithm: "none" }))).toBeNull();
    });
});
