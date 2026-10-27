import { api, post } from "../api/client";
import { clearOfflineRoster, getOfflineIdentity, readOfflineRoster, saveOfflineIdentity, setOfflineRosterDisabled } from "./offlineRoster";

export const login = (v) => post("/auth/login", v);
export async function logout() {
  try {
    return await post("/auth/logout");
  } finally {
    const identity = await getOfflineIdentity().catch(() => null);
    if (identity?.id) setOfflineRosterDisabled(identity.id, false);
    await clearOfflineRoster().catch(() => undefined);
  }
}
export async function fetchMe(signal) {
  try {
    const identity = await api("/auth/me", { signal });
    await saveOfflineIdentity(identity).catch(() => undefined);
    return identity;
  } catch (error) {
    if (error?.status !== 0) throw error;
    const identity = await getOfflineIdentity();
    if (!identity?.id || identity.role !== "BOOTH_MEMBER") throw error;
    const roster = await readOfflineRoster();
    if (!roster) throw error;
    return identity;
  }
}
