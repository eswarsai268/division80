import "./syntheticBackendEnv.js";
import { describe, expect, it, vi } from "vitest";

const { getOrLoadJson, redisCacheKey } = await import("../src/cache/jsonCache.js");

describe("Redis JSON cache", () => {
    it("uses organization-scoped, versioned dashboard keys", () => {
        expect(redisCacheKey("dashboard", "admin", "org-a")).toBe("cache:v1:dashboard:admin:org-a");
        expect(redisCacheKey("dashboard", "booth", "org-a")).not.toBe(redisCacheKey("dashboard", "booth", "org-b"));
    });

    it("loads from the source when Redis is not ready", async () => {
        const load = vi.fn().mockResolvedValue({ total: 3 });

        await expect(getOrLoadJson({ isReady: false }, "key", 10, load)).resolves.toEqual({ total: 3 });
        expect(load).toHaveBeenCalledOnce();
    });

    it("returns a cached value without querying the source", async () => {
        const client = { isReady: true, get: vi.fn().mockResolvedValue('{"total":3}') };
        const load = vi.fn();

        await expect(getOrLoadJson(client, "key", 10, load)).resolves.toEqual({ total: 3 });
        expect(load).not.toHaveBeenCalled();
    });

    it("stores source results with the requested expiry", async () => {
        const value = { total: 4 };
        const client = { isReady: true, get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue("OK") };

        await expect(getOrLoadJson(client, "key", 10, async () => value)).resolves.toBe(value);
        expect(client.set).toHaveBeenCalledWith("key", JSON.stringify(value), { EX: 10 });
    });

    it("coalesces concurrent misses for the same key", async () => {
        const value = { total: 8 };
        const client = { isReady: true, get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue("OK") };
        const load = vi.fn().mockResolvedValue(value);

        const results = await Promise.all([
            getOrLoadJson(client, "coalesced-key", 10, load),
            getOrLoadJson(client, "coalesced-key", 10, load),
        ]);

        expect(results).toEqual([value, value]);
        expect(load).toHaveBeenCalledOnce();
    });

    it("falls back to the source when Redis reads fail", async () => {
        const load = vi.fn().mockResolvedValue({ total: 5 });
        const client = { isReady: true, get: vi.fn().mockRejectedValue(Object.assign(new Error("unavailable"), { code: "ECONNRESET" })) };

        await expect(getOrLoadJson(client, "key", 10, load)).resolves.toEqual({ total: 5 });
        expect(load).toHaveBeenCalledOnce();
    });

    it("deletes malformed cache values and reloads from the source", async () => {
        const client = { isReady: true, get: vi.fn().mockResolvedValue("not-json"), del: vi.fn().mockResolvedValue(1), set: vi.fn().mockResolvedValue("OK") };
        const load = vi.fn().mockResolvedValue({ total: 6 });

        await expect(getOrLoadJson(client, "key", 10, load)).resolves.toEqual({ total: 6 });
        expect(client.del).toHaveBeenCalledWith("key");
        expect(client.set).toHaveBeenCalledOnce();
    });

    it("does not fail a request when Redis writes fail", async () => {
        const value = { total: 7 };
        const client = { isReady: true, get: vi.fn().mockResolvedValue(null), set: vi.fn().mockRejectedValue(new Error("unavailable")) };

        await expect(getOrLoadJson(client, "key", 10, async () => value)).resolves.toBe(value);
    });
});
