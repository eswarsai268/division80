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

    const whatsappPhoneNumberId = source.WHATSAPP_PHONE_NUMBER_ID ?? "";
    const whatsappApiVersion = source.WHATSAPP_API_VERSION ?? "";
    const whatsappDefaultCountryCode = source.WHATSAPP_DEFAULT_COUNTRY_CODE ?? "91";
    if (whatsappPhoneNumberId && !/^\d{1,32}$/.test(whatsappPhoneNumberId)) errors.push("WHATSAPP_PHONE_NUMBER_ID");
    if (whatsappApiVersion && !/^v\d+\.\d+$/.test(whatsappApiVersion)) errors.push("WHATSAPP_API_VERSION");
    if (!/^[1-9]\d{0,3}$/.test(whatsappDefaultCountryCode)) errors.push("WHATSAPP_DEFAULT_COUNTRY_CODE");

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
        whatsappAccessToken: source.WHATSAPP_ACCESS_TOKEN ?? "",
        whatsappPhoneNumberId,
        whatsappApiVersion,
        whatsappDefaultCountryCode,
    };
}

module.exports = { getWorkerConfig };
