"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const schema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]).default("development"),
    PORT: zod_1.z.coerce.number().default(4000),
    DATABASE_HOST: zod_1.z.string().min(1),
    DATABASE_PORT: zod_1.z.coerce.number().default(4000),
    DATABASE_NAME: zod_1.z.string().default("samasya_medhi"),
    DATABASE_USER: zod_1.z.string().min(1),
    DATABASE_PASSWORD: zod_1.z.string().default(""),
    DATABASE_SSL: zod_1.z.enum(["true", "false"]).default("false"),
    DATABASE_CONNECTION_LIMIT: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    REDIS_URL: zod_1.z.string().optional(),
    JWT_ACCESS_SECRET: zod_1.z.string().min(32, "JWT_ACCESS_SECRET must be >= 32 chars"),
    ACCESS_TOKEN_TTL_SECONDS: zod_1.z.coerce.number().int().default(600),
    REFRESH_TOKEN_TTL_DAYS: zod_1.z.coerce.number().int().default(7),
    CORS_ORIGIN: zod_1.z.string().default("http://localhost:5173"),
    DEFAULT_ORG_SLUG: zod_1.z.string().default("default"),
    TRUST_PROXY_HOPS: zod_1.z.coerce.number().int().min(0).default(0),
    UPLOAD_DIR: zod_1.z.string().default("./uploads"),
    LOG_LEVEL: zod_1.z.string().default("info"),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    // Print variable names only — never values.
    console.error("Invalid environment:", parsed.error.issues.map((i) => i.path.join(".")).join(", "));
    process.exit(1);
}
exports.env = parsed.data;
if (exports.env.NODE_ENV === "production" && !exports.env.REDIS_URL) {
    console.error("REDIS_URL is required in production (distributed rate limiting).");
    process.exit(1);
}
