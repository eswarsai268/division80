import { afterAll } from "vitest";

const values = {
    NODE_ENV: "test",
    DATABASE_HOST: "127.0.0.1",
    DATABASE_USER: "synthetic-test-user",
    DATABASE_PASSWORD: "synthetic-test-password",
    DATABASE_NAME: "synthetic-test-db",
    JWT_ACCESS_SECRET: "x".repeat(40),
    LOG_LEVEL: "silent",
    REDIS_URL: undefined,
};

export function applySyntheticBackendEnv(target) {
    const previous = new Map();
    for (const [key, value] of Object.entries(values)) {
        previous.set(key, { existed: Object.hasOwn(target, key), value: target[key] });
        if (value === undefined)
            delete target[key];
        else
            target[key] = value;
    }

    return () => {
        for (const [key, prior] of previous) {
            if (prior.existed)
                target[key] = prior.value;
            else
                delete target[key];
        }
    };
}

const restoreEnvironment = applySyntheticBackendEnv(process.env);
afterAll(restoreEnvironment);
