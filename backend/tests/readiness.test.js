import "./syntheticBackendEnv.js";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createApp } = await import("../src/app.js");

describe("/ready", () => {
    const pool = { query: vi.fn() };
    const redis = { ping: vi.fn() };
    const app = createApp({ pool, redis });

    beforeEach(() => {
        pool.query.mockReset().mockResolvedValue([[{ 1: 1 }]]);
        redis.ping.mockReset().mockResolvedValue("PONG");
    });

    it("reports ready when database and Redis health checks succeed", async () => {
        const response = await request(app).get("/ready");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "ready" });
        expect(pool.query).toHaveBeenCalledWith("SELECT 1");
        expect(redis.ping).toHaveBeenCalledOnce();
    });

    it("reports unavailable when the Redis health check fails", async () => {
        redis.ping.mockRejectedValueOnce(new Error("synthetic Redis failure"));

        const response = await request(app).get("/ready");

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ status: "unavailable" });
    });
});
