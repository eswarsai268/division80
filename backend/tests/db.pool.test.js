import "./syntheticBackendEnv.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pool, tx } from "../src/db/pool.js";

const connection = {
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
};
const acquireConnection = vi.spyOn(pool, "getConnection");

describe("database transaction helper", () => {
    beforeEach(() => {
        for (const method of Object.values(connection))
            method.mockReset();
        connection.rollback.mockResolvedValue(undefined);
        acquireConnection.mockReset().mockResolvedValue(connection);
    });

    it("commits successful callbacks and releases the connection", async () => {
        const callback = vi.fn(async () => "result");

        await expect(tx(callback)).resolves.toBe("result");
        expect(callback).toHaveBeenCalledWith(connection);
        expect(connection.beginTransaction).toHaveBeenCalledOnce();
        expect(connection.commit).toHaveBeenCalledOnce();
        expect(connection.rollback).not.toHaveBeenCalled();
        expect(connection.release).toHaveBeenCalledOnce();
    });

    it("rolls back and rethrows callback errors while releasing the connection", async () => {
        const originalError = new Error("callback failed");

        await expect(tx(async () => { throw originalError; })).rejects.toBe(originalError);
        expect(connection.rollback).toHaveBeenCalledOnce();
        expect(connection.commit).not.toHaveBeenCalled();
        expect(connection.release).toHaveBeenCalledOnce();
    });

    it("rolls back and releases when commit fails", async () => {
        const commitError = new Error("commit failed");
        connection.commit.mockRejectedValueOnce(commitError);

        await expect(tx(async () => "result")).rejects.toBe(commitError);
        expect(connection.rollback).toHaveBeenCalledOnce();
        expect(connection.release).toHaveBeenCalledOnce();
    });

    it("preserves the transaction error when rollback also fails", async () => {
        const originalError = new Error("callback failed");
        connection.rollback.mockRejectedValueOnce(new Error("rollback failed"));

        await expect(tx(async () => { throw originalError; })).rejects.toBe(originalError);
        expect(connection.release).toHaveBeenCalledOnce();
    });

    it("does not let a release failure hide the original transaction error", async () => {
        const originalError = new Error("callback failed");
        connection.release.mockImplementationOnce(() => { throw new Error("release failed"); });

        await expect(tx(async () => { throw originalError; })).rejects.toBe(originalError);
        expect(connection.rollback).toHaveBeenCalledOnce();
        expect(connection.release).toHaveBeenCalledOnce();
    });

    it("propagates a release failure after an otherwise successful transaction", async () => {
        const releaseError = new Error("release failed");
        connection.release.mockImplementationOnce(() => { throw releaseError; });

        await expect(tx(async () => "result")).rejects.toBe(releaseError);
        expect(connection.commit).toHaveBeenCalledOnce();
    });

    it("does not attempt release when acquiring a connection fails", async () => {
        const acquireError = new Error("pool acquisition failed");
        acquireConnection.mockRejectedValueOnce(acquireError);

        await expect(tx(async () => undefined)).rejects.toBe(acquireError);
        expect(connection.release).not.toHaveBeenCalled();
    });
});
