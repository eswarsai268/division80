export function isAuthzDatabaseTestEnabled(env) {
    return env.TEST_DB === "1";
}
