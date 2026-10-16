import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const backendRoot = new URL("..", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const script = `
const Module = require("node:module");
const { EventEmitter } = require("node:events");
const client = new EventEmitter();
client.isOpen = false;
const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "redis") return { createClient: () => client };
  return load.call(this, request, parent, isMain);
};
const { redis } = require("./src/cache/redis.js");
redis.emit("error", Object.assign(new Error("redis://synthetic-user:synthetic-secret@127.0.0.1:6379 failed"), {
  code: "ECONNRESET", address: "127.0.0.1", port: 6379,
}));
redis.emit("error", { message: "private connection detail", code: 42 });
`;

describe("Redis error handling", () => {
    it("logs only sanitized codes and handles client errors without crashing", () => {
        const result = spawnSync(process.execPath, ["-e", script], {
            cwd: backendRoot,
            env: {
                PATH: process.env.PATH ?? process.env.Path,
                SystemRoot: process.env.SystemRoot,
                WINDIR: process.env.WINDIR,
                NODE_ENV: "test",
                DATABASE_HOST: "127.0.0.1",
                DATABASE_USER: "synthetic-test-user",
                JWT_ACCESS_SECRET: "x".repeat(40),
                REDIS_URL: "redis://synthetic-user:synthetic-secret@127.0.0.1:6379",
            },
            encoding: "utf8",
        });

        expect(result.status, result.stderr).toBe(0);
        const loggedOutput = `${result.stdout}${result.stderr}`;
        expect(loggedOutput).toContain('"redisErrorCode":"ECONNRESET"');
        expect(loggedOutput).toContain('"redisErrorCode":"UNKNOWN"');
        expect(loggedOutput).not.toContain("synthetic-secret");
        expect(loggedOutput).not.toContain("127.0.0.1");
        expect(loggedOutput).not.toContain("6379");
        expect(loggedOutput).not.toContain("private connection detail");
    });
});
