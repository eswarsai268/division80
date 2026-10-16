import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseApiEnv = {
    DATABASE_HOST: "127.0.0.1",
    DATABASE_USER: "synthetic-test-user",
    JWT_ACCESS_SECRET: "a".repeat(40),
};

function cleanChildEnv(values) {
    const env = {};
    const pathValue = process.env.PATH ?? process.env.Path;
    if (pathValue)
        env.PATH = pathValue;
    for (const key of ["SystemRoot", "WINDIR", "TEMP", "TMP"]) {
        if (process.env[key])
            env[key] = process.env[key];
    }
    return { ...env, ...values };
}

function loadApiConfig(env) {
    return spawnSync(process.execPath, ["-e", "require('./src/config/env.js')"], {
        cwd: backendRoot,
        env: cleanChildEnv(env),
        encoding: "utf8",
    });
}

describe("backend environment validation", () => {
    it("rejects missing and unsupported NODE_ENV without exposing values", () => {
        const missing = loadApiConfig(baseApiEnv);
        expect(missing.status).toBe(1);
        expect(missing.stderr).toContain("NODE_ENV");

        const invalid = loadApiConfig({ ...baseApiEnv, NODE_ENV: "invalid-mode" });
        expect(invalid.status).toBe(1);
        expect(invalid.stderr).toContain("NODE_ENV");
        expect(invalid.stderr).not.toContain("invalid-mode");
    });

    it.each(["development", "test"]) ("accepts %s configuration", (nodeEnv) => {
        const result = loadApiConfig({ ...baseApiEnv, NODE_ENV: nodeEnv });
        expect(result.status).toBe(0);
    });

    it("accepts valid production TLS, CORS, and Redis settings without connecting", () => {
        const result = loadApiConfig({
            ...baseApiEnv,
            NODE_ENV: "production",
            DATABASE_SSL: "true",
            CORS_ORIGIN: "https://app.example.test",
            REDIS_URL: "redis://127.0.0.1:6379",
        });
        expect(result.status).toBe(0);
    });

    it("rejects production without database TLS", () => {
        const result = loadApiConfig({
            ...baseApiEnv,
            NODE_ENV: "production",
            CORS_ORIGIN: "https://app.example.test",
            REDIS_URL: "redis://127.0.0.1:6379",
        });
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("DATABASE_SSL");
    });

    it("rejects production with an insecure CORS origin", () => {
        const result = loadApiConfig({
            ...baseApiEnv,
            NODE_ENV: "production",
            DATABASE_SSL: "true",
            CORS_ORIGIN: "http://app.example.test",
            REDIS_URL: "redis://127.0.0.1:6379",
        });
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("CORS_ORIGIN");
    });

    it("rejects production without Redis", () => {
        const result = loadApiConfig({
            ...baseApiEnv,
            NODE_ENV: "production",
            DATABASE_SSL: "true",
            CORS_ORIGIN: "https://app.example.test",
        });
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("REDIS_URL");
    });
});

describe("worker environment validation", () => {
    let getWorkerConfig;
    it("loads the pure worker config validator", async () => {
        ({ getWorkerConfig } = (await import("../../worker/src/config.js")).default);
        expect(getWorkerConfig).toBeTypeOf("function");
    });

    const validWorkerEnv = (overrides = {}) => ({
        NODE_ENV: "test",
        DATABASE_HOST: "127.0.0.1",
        DATABASE_USER: "synthetic-test-user",
        ...overrides,
    });

    it("requires a supported NODE_ENV", () => {
        expect(() => getWorkerConfig(validWorkerEnv({ NODE_ENV: undefined }))).toThrow("NODE_ENV");
        expect(() => getWorkerConfig(validWorkerEnv({ NODE_ENV: "invalid-mode" }))).toThrow("NODE_ENV");
    });

    it.each(["development", "test"]) ("accepts %s configuration", (nodeEnv) => {
        expect(getWorkerConfig(validWorkerEnv({ NODE_ENV: nodeEnv })).nodeEnv).toBe(nodeEnv);
    });

    it("accepts production only with TLS enabled", () => {
        expect(getWorkerConfig(validWorkerEnv({ NODE_ENV: "production", DATABASE_SSL: "true" })).databaseSsl).toBe("true");
        expect(() => getWorkerConfig(validWorkerEnv({ NODE_ENV: "production" }))).toThrow("DATABASE_SSL");
    });

    it("requires database host and user and validates the port", () => {
        expect(() => getWorkerConfig(validWorkerEnv({ DATABASE_HOST: "" }))).toThrow("DATABASE_HOST");
        expect(() => getWorkerConfig(validWorkerEnv({ DATABASE_USER: "" }))).toThrow("DATABASE_USER");
        expect(() => getWorkerConfig(validWorkerEnv({ DATABASE_PORT: "not-a-port" }))).toThrow("DATABASE_PORT");
    });
});

describe("authorization integration test opt-in", () => {
    it("stays disabled when TEST_DB is unset or false", async () => {
        const { isAuthzDatabaseTestEnabled } = await import("./authzTestGate.mjs");
        expect(isAuthzDatabaseTestEnabled({})).toBe(false);
        expect(isAuthzDatabaseTestEnabled({ TEST_DB: "false" })).toBe(false);
        expect(isAuthzDatabaseTestEnabled({ TEST_DB: "1" })).toBe(true);
    });
});
