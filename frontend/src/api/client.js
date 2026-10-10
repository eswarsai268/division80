const BASE = "/api/v1";
export class ApiError extends Error {
    status;
    code;
    details;
    constructor(status, code, message, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
let refreshing = null; // single in-flight refresh => no refresh storms
const raw = (path, init = {}) => fetch(BASE + path, { ...init, credentials: "include", headers: { "Content-Type": "application/json", "X-Requested-With": "samasya-web", ...(init.headers ?? {}) } });
export async function api(path, init = {}) {
    let res = await raw(path, init);
    // Refresh at most ONCE per call and never for /auth/* (prevents infinite loops).
    if (res.status === 401 && !path.startsWith("/auth/")) {
        refreshing ??= raw("/auth/refresh", { method: "POST" }).then((r) => r.ok).finally(() => { refreshing = null; });
        if (await refreshing)
            res = await raw(path, init);
    }
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success)
        throw new ApiError(res.status, body?.error?.code ?? "UNKNOWN", body?.error?.message ?? "Request failed", body?.error?.details);
    return body.data;
}
export const post = (path, data, headers) => api(path, { method: "POST", body: JSON.stringify(data ?? {}), headers });
export async function download(path, filename) {
    const res = await raw(path);
    if (!res.ok)
        throw new ApiError(res.status, "DOWNLOAD_FAILED", "Download failed");
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export const patch = (path, body) => api(path, { method: "PATCH", body: JSON.stringify(body) });
