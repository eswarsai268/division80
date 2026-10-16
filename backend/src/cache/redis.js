"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeRedis = exports.connectRedis = exports.redis = void 0;
const redis_1 = require("redis");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
// Redis is used for rate limiting and public-content caching ONLY.
// It is never a source of truth for authorization.
exports.redis = env_1.env.REDIS_URL ? (0, redis_1.createClient)({ url: env_1.env.REDIS_URL }) : null;
if (exports.redis)
    exports.redis.on("error", (error) => logger_1.logger.error({ redisErrorCode: typeof error?.code === "string" ? error.code : "UNKNOWN" }, "Redis client error"));
const connectRedis = async () => { if (exports.redis && !exports.redis.isOpen)
    await exports.redis.connect(); };
exports.connectRedis = connectRedis;
const closeRedis = async () => { if (exports.redis?.isOpen)
    await exports.redis.quit(); };
exports.closeRedis = closeRedis;
