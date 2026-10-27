"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrLoadJson = getOrLoadJson;
exports.redisCacheKey = redisCacheKey;

const logger_1 = require("../utils/logger");
const inFlightLoads = new Map();

function redisErrorCode(error) {
    return typeof error?.code === "string" ? error.code : "UNKNOWN";
}

function redisCacheKey(namespace, ...parts) {
    return ["cache", "v1", namespace, ...parts].join(":");
}

/** Read a JSON cache entry, falling back to the source of truth on cache failures. */
async function getOrLoadJson(client, key, ttlSeconds, load) {
    const inFlight = inFlightLoads.get(key);
    if (inFlight)
        return inFlight;

    const pending = client?.isReady
        ? loadOrReadThrough(client, key, ttlSeconds, load)
        : Promise.resolve().then(load);
    inFlightLoads.set(key, pending);
    try {
        return await pending;
    }
    finally {
        if (inFlightLoads.get(key) === pending)
            inFlightLoads.delete(key);
    }
}

async function loadOrReadThrough(client, key, ttlSeconds, load) {
    let cached;
    try {
        cached = await client.get(key);
    }
    catch (error) {
        logger_1.logger.warn({ redisErrorCode: redisErrorCode(error) }, "Redis cache read failed");
    }

    if (cached !== null && cached !== undefined) {
        try {
            return JSON.parse(cached);
        }
        catch (error) {
            logger_1.logger.warn({ redisErrorCode: "INVALID_CACHE_VALUE" }, "Redis cache value was invalid JSON");
            await client.del(key).catch(() => undefined);
        }
    }

    const value = await load();
    if (client.isReady) {
        try {
            await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
        }
        catch (error) {
            logger_1.logger.warn({ redisErrorCode: redisErrorCode(error) }, "Redis cache write failed");
        }
    }
    return value;
}
