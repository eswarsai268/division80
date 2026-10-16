"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicContent = getPublicContent;
exports.getLoginMedia = getLoginMedia;
exports.invalidatePublicContent = invalidatePublicContent;
const env_1 = require("../config/env");
const pool_1 = require("../db/pool");
const redis_1 = require("../cache/redis");

const cacheKeys = [
    `public:${env_1.env.DEFAULT_ORG_SLUG}:EVENT`,
    `public:${env_1.env.DEFAULT_ORG_SLUG}:ANNOUNCEMENT`,
];

async function getPublicContent(kind) {
    const key = `public:${env_1.env.DEFAULT_ORG_SLUG}:${kind}`;
    const hit = redis_1.redis?.isOpen ? await redis_1.redis.get(key).catch(() => null) : null;
    if (hit)
        return JSON.parse(hit);
    const rows = await (0, pool_1.query)(`SELECT e.id, e.title, e.body, e.starts_at AS startsAt, e.published_at AS publishedAt FROM events e
       JOIN organizations o ON o.id = e.organization_id
      WHERE o.slug = ? AND e.kind = ? AND e.status = 'PUBLISHED' ORDER BY COALESCE(e.starts_at, e.published_at) DESC LIMIT 50`, [env_1.env.DEFAULT_ORG_SLUG, kind]);
    if (redis_1.redis?.isOpen)
        await redis_1.redis.set(key, JSON.stringify(rows), { EX: 60 }).catch(() => undefined);
    return rows;
}

async function getLoginMedia() {
    const row = (await (0, pool_1.query)(`SELECT s.login_video_url AS loginVideoUrl FROM organizations o
      LEFT JOIN organization_settings s ON s.organization_id = o.id WHERE o.slug = ?`, [env_1.env.DEFAULT_ORG_SLUG]))[0];
    return { loginVideoUrl: row?.loginVideoUrl ?? null };
}

async function invalidatePublicContent() {
    await redis_1.redis?.del(cacheKeys).catch(() => undefined);
}
