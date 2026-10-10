export const homeFor = (role) => (role === "ADMIN" ? "/admin/dashboard" : role === "BOOTH_MEMBER" ? "/booth/dashboard" : "/home");
export const loginFor = (role) => (role === "ADMIN" ? "/admin/login" : role === "BOOTH_MEMBER" ? "/booth/login" : "/login");
