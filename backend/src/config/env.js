"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const corsOrigin = zod_1.z.string().url().default("http://localhost:5173").superRefine((value, ctx) => {
    let parsed;
    try {
        parsed = new URL(value);
    }
    catch {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "CORS_ORIGIN must be one exact HTTP(S) origin" });
        return;
    }
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== value || parsed.username || parsed.password) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "CORS_ORIGIN must be one exact HTTP(S) origin without credentials, path, or trailing slash" });
    }
});
const schema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]),
    PORT: zod_1.z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_HOST: zod_1.z.string().min(1),
    DATABASE_PORT: zod_1.z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_NAME: zod_1.z.string().default("samasya_medhi"),
    DATABASE_USER: zod_1.z.string().min(1),
    DATABASE_PASSWORD: zod_1.z.string().default(""),
    DATABASE_SSL: zod_1.z.enum(["true", "false"]).default("false"),
    DATABASE_CONNECTION_LIMIT: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    REDIS_URL: zod_1.z.string().optional(),
    JWT_ACCESS_SECRET: zod_1.z.string().min(32, "JWT_ACCESS_SECRET must be >= 32 chars"),
    ACCESS_TOKEN_TTL_SECONDS: zod_1.z.coerce.number().int().min(60).max(1800).default(600),
    REFRESH_TOKEN_TTL_DAYS: zod_1.z.coerce.number().int().min(1).max(30).default(30),
    CORS_ORIGIN: corsOrigin,
    DEFAULT_ORG_SLUG: zod_1.z.string().default("default"),
    TRUST_PROXY_HOPS: zod_1.z.coerce.number().int().min(0).max(5).default(0),
    UPLOAD_DIR: zod_1.z.string().default("./uploads"),
    LOG_LEVEL: zod_1.z.string().default("info"),
    WHATSAPP_ACCESS_TOKEN: zod_1.z.string().optional(),
    WHATSAPP_PHONE_NUMBER_ID: zod_1.z.string().regex(/^\d{1,32}$/).optional(),
    WHATSAPP_BUSINESS_ACCOUNT_ID: zod_1.z.string().regex(/^\d{1,32}$/).optional(),
    WHATSAPP_API_VERSION: zod_1.z.string().regex(/^v\d+\.\d+$/).optional(),
    WHATSAPP_DEFAULT_COUNTRY_CODE: zod_1.z.string().regex(/^[1-9]\d{0,3}$/).default("91"),
}).superRefine((config, ctx) => {
    if (config.NODE_ENV === "production" && config.DATABASE_SSL !== "true") {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["DATABASE_SSL"],
            message: "DATABASE_SSL=true is required in production",
        });
    }
    if (config.NODE_ENV === "production" && !config.CORS_ORIGIN.startsWith("https://")) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["CORS_ORIGIN"], message: "CORS_ORIGIN must use HTTPS in production" });
    }
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
