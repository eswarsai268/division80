const { env } = require("./config/env");
const { connectRedis, closeRedis } = require("./cache/redis");
const { closePool } = require("./db/pool");
const { logger } = require("./utils/logger");

async function main() {
  // Redis must be connected BEFORE the app (and its rate limiters) is loaded.
  await connectRedis();
  const { createApp } = require("./app");
  const server = createApp().listen(env.PORT, () => logger.info({ port: env.PORT }, "api listening"));
  const stop = () => {
    logger.info("shutting down");
    server.close(async () => {
      await closeRedis().catch(() => undefined);
      await closePool().catch(() => undefined);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((e) => {
  logger.fatal({ err: e }, "startup failed");
  process.exit(1);
});