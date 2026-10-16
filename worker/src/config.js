"use strict";

const NODE_ENV_VALUES = new Set(["development", "test", "production"]);

function getWorkerConfig(source = process.env) {
    const errors = [];
    const nodeEnv = source.NODE_ENV;
    if (!NODE_ENV_VALUES.has(nodeEnv))
        errors.push("NODE_ENV");

    const databaseHost = source.DATABASE_HOST;
    if (typeof databaseHost !== "string" || databaseHost.trim() === "")
        errors.push("DATABASE_HOST");

    const databaseUser = source.DATABASE_USER;
    if (typeof databaseUser !== "string" || databaseUser.trim() === "")
        errors.push("DATABASE_USER");

    const databasePort = Number(source.DATABASE_PORT ?? 4000);
    if (!Number.isInteger(databasePort) || databasePort < 1 || databasePort > 65535)
        errors.push("DATABASE_PORT");

    const databaseSsl = source.DATABASE_SSL ?? "false";
    if (databaseSsl !== "true" && databaseSsl !== "false")
        errors.push("DATABASE_SSL");
    if (nodeEnv === "production" && databaseSsl !== "true" && !errors.includes("DATABASE_SSL"))
        errors.push("DATABASE_SSL");

    if (errors.length)
        throw new Error(`Invalid worker environment: ${[...new Set(errors)].join(", ")}`);

    return {
        nodeEnv,
        databaseHost,
        databasePort,
        databaseUser,
        databasePassword: source.DATABASE_PASSWORD ?? "",
        databaseName: source.DATABASE_NAME ?? "samasya_medhi",
        databaseSsl,
    };
}

module.exports = { getWorkerConfig };
