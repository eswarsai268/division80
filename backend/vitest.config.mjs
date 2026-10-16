import { defineConfig } from "vitest/config";
process.env.NODE_ENV = "test";
export default defineConfig({ test: { include: ["tests/**/*.test.js"], fileParallelism: false, testTimeout: 30000 } });
