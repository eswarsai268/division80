import { patch } from "../api/client";

export const updateProfile = (v) => patch("/profile", { fullName: v.fullName, phone: v.phone || null });
