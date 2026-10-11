import { patch } from "../api/client";

const normalizePhone = (digits) => digits ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : null;

export const updateProfile = (v) => patch("/profile", {
  fullName: v.fullName.trim(),
  phone: normalizePhone(v.phone),
});
