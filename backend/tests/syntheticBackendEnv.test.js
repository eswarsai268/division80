import { describe, expect, it } from "vitest";
import { applySyntheticBackendEnv } from "./syntheticBackendEnv.js";

describe("synthetic backend environment setup", () => {
    it("removes synthetic values and restores variables that were initially unset", () => {
        const target = {};
        const restore = applySyntheticBackendEnv(target);

        expect(target.NODE_ENV).toBe("test");
        expect(target.REDIS_URL).toBeUndefined();
        restore();

        expect(target).toEqual({});
    });

    it("restores previous values and leaves unrelated variables untouched", () => {
        const target = {
            NODE_ENV: "preexisting-mode",
            DATABASE_HOST: "preexisting-host",
            REDIS_URL: "redis://preexisting",
            UNRELATED_VALUE: "keep-me",
        };
        const restore = applySyntheticBackendEnv(target);

        expect(target.NODE_ENV).toBe("test");
        expect(target.DATABASE_HOST).toBe("127.0.0.1");
        expect(target.REDIS_URL).toBeUndefined();
        restore();

        expect(target).toEqual({
            NODE_ENV: "preexisting-mode",
            DATABASE_HOST: "preexisting-host",
            REDIS_URL: "redis://preexisting",
            UNRELATED_VALUE: "keep-me",
        });
    });
});
