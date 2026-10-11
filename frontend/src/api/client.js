const configuredBase = (import.meta.env.VITE_API_BASE_URL?.trim() || "/api/v1").replace(/\/+$/, "");
if (configuredBase.includes("\\") || configuredBase.startsWith("//") || /[?#]/.test(configuredBase)) {
    throw new TypeError("VITE_API_BASE_URL must be a path or HTTP(S) URL without query parameters");
}
const parsedBase = new URL(configuredBase, window.location.origin);
if (!["http:", "https:"].includes(parsedBase.protocol) || parsedBase.username || parsedBase.password
    || (!configuredBase.startsWith("/") && !/^[a-z][a-z\d+.-]*:\/\//i.test(configuredBase))) {
    throw new TypeError("VITE_API_BASE_URL must be a same-origin path or an absolute HTTP(S) URL");
}
const BASE_PATH = parsedBase.pathname.replace(/\/+$/, "");
const BASE = configuredBase.startsWith("/") ? BASE_PATH : `${parsedBase.origin}${BASE_PATH}`;
const NO_REFRESH_PATHS = new Set(["/auth/login", "/auth/register", "/auth/logout", "/auth/refresh"]);

export class ApiError extends Error {
    status;
    code;
    details;
    requestId;
    url;
    constructor(status, code, message, details, requestId, url) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
        this.details = details;
        this.requestId = requestId;
        this.url = url;
    }
}

let refreshing = null;

function resolveUrl(path) {
    if (typeof path !== "string" || !path.trim() || /^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith("//") || path.includes("\\")) {
        throw new TypeError("API path must be a relative path, such as /admin/dashboard");
    }
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    if (BASE_PATH && (normalizedPath === BASE_PATH || normalizedPath.startsWith(`${BASE_PATH}/`))) {
        throw new TypeError(`Pass a path relative to ${BASE}; do not include the API base path twice`);
    }
    return `${BASE}${normalizedPath}`;
}

async function raw(url, init = {}) {
    try {
        return await fetch(url, {
            ...init,
            credentials: "include",
            headers: { "X-Requested-With": "samasya-web", ...(init.headers ?? {}) },
        });
    } catch (error) {
        if (error?.name === "AbortError")
            throw error;
        const endpoint = new URL(url, window.location.origin).pathname;
        throw new ApiError(0, "NETWORK_ERROR", `Cannot reach the API endpoint ${endpoint}. Check that the server is running and the API URL is configured correctly.`, undefined, undefined, url);
    }
}

async function fetchWithRefresh(path, init = {}) {
    const url = resolveUrl(path);
    let res = await raw(url, init);
    if (res.status === 401 && !NO_REFRESH_PATHS.has(path)) {
        refreshing ??= raw(resolveUrl("/auth/refresh"), { method: "POST" })
            .then((refreshResponse) => refreshResponse.ok)
            .finally(() => { refreshing = null; });
        if (await refreshing)
            res = await raw(url, init);
    }
    return { res, url };
}

async function parseResponse(res, url) {
    const requestId = res.headers.get("x-request-id") ?? undefined;
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) {
        const endpoint = new URL(url, window.location.origin).pathname;
        const message = body?.error?.message
            ?? (res.status === 404 ? `API endpoint not found: ${endpoint}` : `API request failed with HTTP ${res.status}`);
        throw new ApiError(res.status, body?.error?.code ?? "INVALID_RESPONSE", message, body?.error?.details, body?.requestId ?? requestId, url);
    }
    return body.data;
}

export async function api(path, init = {}) {
    const { res, url } = await fetchWithRefresh(path, init);
    return parseResponse(res, url);
}

export const post = (path, data, headers) => api(path, {
    method: "POST",
    body: JSON.stringify(data ?? {}),
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
});

export async function download(path, filename) {
    const { res, url } = await fetchWithRefresh(path);
    if (!res.ok) {
        await parseResponse(res, url);
        throw new ApiError(res.status, "DOWNLOAD_FAILED", `Download failed with HTTP ${res.status}`, undefined, res.headers.get("x-request-id") ?? undefined, url);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export const patch = (path, body) => api(path, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
});
