import { api, post } from "../api/client";

export const login = (v) => post("/auth/login", v);
export const logout = () => post("/auth/logout");
export const fetchMe = (signal) => api("/auth/me", { signal });
