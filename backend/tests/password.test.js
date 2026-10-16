import { beforeAll, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/auth/password.js";

describe("password helpers", () => {
    let storedHash;

    beforeAll(async () => {
        storedHash = await hashPassword("correct-horse-battery");
    });

    it("verifies the correct password and rejects an incorrect password", async () => {
        await expect(verifyPassword(storedHash, "correct-horse-battery")).resolves.toBe(true);
        await expect(verifyPassword(storedHash, "incorrect-password")).resolves.toBe(false);
    });

    it("returns false for malformed stored hashes", async () => {
        await expect(verifyPassword("not-an-argon2-hash", "any-password")).resolves.toBe(false);
    });

    it("propagates hashing failures", async () => {
        await expect(hashPassword(null)).rejects.toThrow();
    });
});
