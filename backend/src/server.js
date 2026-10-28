const { env } = require("./config/env");
const { connectRedis, closeRedis } = require("./cache/redis");
const { closePool } = require("./db/pool");
const { logger } = require("./utils/logger");

// Prevent unhandled errors from crashing the process (which causes 502s on Render).
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception");
  // Fatal listen errors must terminate so the process manager can restart cleanly.
  if (err?.code === "EADDRINUSE" || err?.code === "EACCES") {
    process.exit(1);
  }
});
process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "unhandled promise rejection");
});

async function main() {
  // Redis must be connected BEFORE the app (and its rate limiters) is loaded.
  await connectRedis();
  const { createApp } = require("./app");
  const server = createApp().listen(env.PORT, "0.0.0.0", () => logger.info({ port: env.PORT }, "api listening"));
  server.on("error", (err) => {
    logger.fatal({ err }, "http server error");
    process.exit(1);
  });
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


