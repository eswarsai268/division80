import { api } from "../api/client";

const DATABASE = "samasya-offline-roster";
const VERSION = 1;
const STORES = ["identity", "roster", "keys"];
const CURRENT = "current";
const DISABLED_KEY_PREFIX = "samasya-offline-disabled:";
const SYNC_PAGE_SIZE = 1000;
const FRESH_OFFLINE_COPY_MS = 6 * 60 * 60 * 1000;
let activeSync;
let activeSyncOwner;
let memoryRoster;
let memoryRosterOwner;
let memoryRosterUpdatedAt;

export function isOfflineRosterDisabled(userId) {
  try { return localStorage.getItem(`${DISABLED_KEY_PREFIX}${userId}`) === "1"; } catch { return false; }
}

export function setOfflineRosterDisabled(userId, disabled) {
  try {
    if (disabled) localStorage.setItem(`${DISABLED_KEY_PREFIX}${userId}`, "1");
    else localStorage.removeItem(`${DISABLED_KEY_PREFIX}${userId}`);
  } catch { /* Logout still clears the cache when storage preferences are unavailable. */ }
}

function openDatabase() {
  if (!globalThis.indexedDB || !globalThis.crypto?.subtle) {
    return Promise.reject(new Error("This device does not support secure offline storage."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      for (const store of STORES) {
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline storage."));
    request.onblocked = () => reject(new Error("Offline storage is busy in another app tab."));
  });
}

async function read(storeName) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(storeName, "readonly").objectStore(storeName).get(CURRENT);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error ?? new Error("Could not read offline storage."));
    });
  } finally {
    db.close();
  }
}

async function write(storeName, value) {
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put({ ...value, id: CURRENT });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error ?? new Error("Could not save offline data."));
      tx.onabort = () => reject(tx.error ?? new Error("Could not save offline data."));
    });
  } finally {
    db.close();
  }
}

export async function clearOfflineRoster() {
  memoryRoster = undefined;
  memoryRosterOwner = undefined;
  memoryRosterUpdatedAt = undefined;
  if (!globalThis.indexedDB) return;
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES, "readwrite");
      for (const name of STORES) tx.objectStore(name).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error ?? new Error("Could not clear offline data."));
      tx.onabort = () => reject(tx.error ?? new Error("Could not clear offline data."));
    });
  } finally {
    db.close();
  }
}

export async function saveOfflineIdentity(identity) {
  if (identity?.role !== "BOOTH_MEMBER" || !identity.id || !identity.organizationId) {
    await clearOfflineRoster();
    return;
  }
  const prior = await read("identity");
  const priorBooths = [...(prior?.profile?.boothIds ?? [])].sort().join(",");
  const currentBooths = [...(identity.boothIds ?? [])].sort().join(",");
  if (prior && (prior.userId !== identity.id || prior.organizationId !== identity.organizationId || priorBooths !== currentBooths)) {
    await clearOfflineRoster();
  }
  await write("identity", {
    userId: identity.id,
    organizationId: identity.organizationId,
    profile: { ...identity, isOffline: false },
    savedAt: Date.now(),
  });
}

export async function getOfflineIdentity() {
  const record = await read("identity");
  if (!record || record.profile?.role !== "BOOTH_MEMBER" || !record.userId || !record.organizationId) return null;
  return { ...record.profile, isOffline: true };
}

export async function getOfflineInfo() {
  const [identity, roster] = await Promise.all([read("identity"), read("roster")]);
  if (!identity || !roster || identity.profile?.role !== "BOOTH_MEMBER"
      || roster.userId !== identity.userId || roster.organizationId !== identity.organizationId) return null;
  return { updatedAt: roster.updatedAt, householdCount: roster.householdCount, peopleCount: roster.peopleCount };
}

export async function readOfflineRoster() {
  const [identity, roster, keyRecord] = await Promise.all([read("identity"), read("roster"), read("keys")]);
  if (!identity || !roster || !keyRecord || identity.profile?.role !== "BOOTH_MEMBER"
      || roster.userId !== identity.userId || roster.organizationId !== identity.organizationId) return null;
  if (memoryRoster && memoryRosterOwner === identity.userId && memoryRosterUpdatedAt === roster.updatedAt) return memoryRoster;
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(roster.iv) },
    keyRecord.cryptoKey,
    roster.ciphertext,
  );
  memoryRoster = JSON.parse(new TextDecoder().decode(decrypted));
  memoryRosterOwner = identity.userId;
  memoryRosterUpdatedAt = roster.updatedAt;
  return memoryRoster;
}

export async function saveOfflineRoster(identity, data, serverRevision) {
  const priorIdentity = await read("identity");
  if (!priorIdentity || priorIdentity.userId !== identity.id || priorIdentity.organizationId !== identity.organizationId) {
    throw new Error("Sign in again before saving this roster offline.");
  }
  const cryptoKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, bytes);
  const peopleCount = data.households.reduce((count, house) => count + house.citizens.length, 0);
  const updatedAt = Math.max(Date.now(), (memoryRosterUpdatedAt ?? 0) + 1);
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(["roster", "keys"], "readwrite");
      tx.objectStore("roster").put({
        id: CURRENT,
        userId: identity.id,
        organizationId: identity.organizationId,
        iv: Array.from(iv),
        ciphertext,
        householdCount: data.households.length,
        peopleCount,
        serverRevision,
        updatedAt,
      });
      tx.objectStore("keys").put({ id: CURRENT, cryptoKey });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error ?? new Error("Could not save offline data."));
      tx.onabort = () => reject(tx.error ?? new Error("Could not save offline data."));
    });
  } finally {
    db.close();
  }
  memoryRoster = data;
  memoryRosterOwner = identity.id;
  memoryRosterUpdatedAt = updatedAt;
  return { updatedAt, householdCount: data.households.length, peopleCount };
}

export function syncOfflineRoster(identity, onProgress = () => {}) {
  const owner = `${identity.organizationId}:${identity.id}`;
  if (activeSync && activeSyncOwner === owner) return activeSync;
  if (activeSync) return activeSync.catch(() => undefined).then(() => syncOfflineRoster(identity, onProgress));
  activeSyncOwner = owner;
  activeSync = downloadAndSaveRoster(identity, onProgress).finally(() => { activeSync = null; });
  return activeSync;
}

async function downloadAndSaveRoster(identity, onProgress) {
  const [localIdentity, localRoster, currentRevision] = await Promise.all([
    read("identity"),
    read("roster"),
    api("/booth/offline-roster/revision"),
  ]);
  if (localIdentity?.userId === identity.id && localIdentity?.organizationId === identity.organizationId
      && localRoster?.userId === identity.id && localRoster?.organizationId === identity.organizationId
      && localRoster.serverRevision === currentRevision.revision
      && Date.now() - localRoster.updatedAt < FRESH_OFFLINE_COPY_MS) {
    return { updatedAt: localRoster.updatedAt, householdCount: localRoster.householdCount, peopleCount: localRoster.peopleCount };
  }
  const households = [];
  let cursor;
  let totalHouseholds = null;
  do {
    const params = new URLSearchParams({ limit: String(SYNC_PAGE_SIZE) });
    if (cursor) params.set("cursor", cursor);
    const page = await api(`/booth/offline-roster?${params}`);
    households.push(...page.items);
    cursor = page.nextCursor;
    totalHouseholds = page.totalHouseholds;
    onProgress({ completed: households.length, total: totalHouseholds });
  } while (cursor);
  const booths = [...new Map(households.map(({ boothId, boothCode, boothName }) => [boothId, { id: boothId, code: boothCode, name: boothName }])).values()];
  return saveOfflineRoster(identity, { booths, households }, currentRevision.revision);
}

function normalize(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase();
}

export function searchOfflineRoster(data, { search = "", status = "", boothId = "", cursor = null, limit = 100 } = {}) {
  const query = normalize(search).trim();
  const tokens = query.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const matches = data.households.flatMap((house) => {
    if (boothId && house.boothId !== boothId) return [];
    if (status === "UNVERIFIED" && !house.citizens.some((citizen) => !citizen.verificationDone)) return [];
    if (status === "RESOLVED" && (!house.citizens.length || house.citizens.some((citizen) => !citizen.verificationDone))) return [];
    const citizens = house.citizens.filter((citizen) => {
      if (!tokens.length) return true;
      const fields = [citizen.fullName, citizen.fatherOrHusbandName, citizen.rollSerial, citizen.voterId, house.houseCode, house.boothCode, house.boothName];
      const values = fields.map(normalize);
      return tokens.every((token) => values.some((value) => value.includes(token)));
    });
    const houseMatch = normalize(house.houseCode).includes(query);
    if (tokens.length && !citizens.length && !houseMatch) return [];
    return [{ ...house, matchingCitizens: tokens.length ? citizens.map(({ id, fullName, fatherOrHusbandName }) => ({ id, fullName, fatherOrHusbandName })) : [] }];
  });
  const ordered = matches.sort((a, b) => {
    const aHouse = normalize(a.houseCode) === query ? 0 : 1;
    const bHouse = normalize(b.houseCode) === query ? 0 : 1;
    return aHouse - bHouse || a.boothCode.localeCompare(b.boothCode) || a.houseCode.localeCompare(b.houseCode);
  });
  const start = cursor ? Math.max(0, ordered.findIndex((house) => house.id === cursor) + 1) : 0;
  const items = ordered.slice(start, start + limit);
  return {
    offline: true,
    items,
    nextCursor: start + limit < ordered.length ? items.at(-1)?.id ?? null : null,
    totalHouseholds: ordered.length,
    totalPeople: ordered.reduce((count, house) => count + Number(house.citizenCount ?? 0), 0),
  };
}

export function findOfflineHousehold(data, id) {
  const household = data.households.find((item) => item.id === id);
  return household ? { ...household, citizens: household.citizens } : null;
}
