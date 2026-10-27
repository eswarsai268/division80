export function normalizePhone(value) {
  return String(value ?? "").trim().replace(/[()\s-]/g, "");
}

export function isValidPhone(value) {
  return /^\+?[1-9]\d{7,14}$/.test(normalizePhone(value));
}
