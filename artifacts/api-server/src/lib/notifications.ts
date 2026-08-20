import { eq } from "drizzle-orm";
import { db, botUsersTable } from "@workspace/db";
import { getBot } from "./bot";
import { logger } from "./logger";
import type { FirebaseDevice } from "./firebase";

const E = {
  sms: "5453900977432188793",
  panel: "5282843764451195532",
  total: "5246772116543512028",
  online: "5440621591387980068",
  offline: "6206174450765796040",
  lightning: "5224607267797606837",
  gift: "5359664288241829619",
  key: "5249273776079640466",
  credits: "5253742260054409879",
  check: "6206479140040743133",
};

const E_FB: Record<string, string> = {
  "5453900977432188793": "💬",
  "5282843764451195532": "🖥️",
  "6035152649790164056": "🖥️",
  "5246772116543512028": "📊",
  "5440621591387980068": "🟢",
  "6206174450765796040": "⚠️",
  "5224607267797606837": "⚡",
  "5359664288241829619": "🎁",
  "5249273776079640466": "🔑",
  "5253742260054409879": "💎",
  "6206479140040743133": "✅",
};

const SC_MAP: Record<string, string> = {
  A: "ᴀ", B: "ʙ", C: "ᴄ", D: "ᴅ", E: "ᴇ", F: "ꜰ", G: "ɢ", H: "ʜ", I: "ɪ",
  J: "ᴊ", K: "ᴋ", L: "ʟ", M: "ᴍ", N: "ɴ", O: "ᴏ", P: "ᴘ", Q: "ǫ", R: "ʀ",
  S: "ꜱ", T: "ᴛ", U: "ᴜ", V: "ᴠ", W: "ᴡ", X: "x", Y: "ʏ", Z: "ᴢ",
};

function em(id: string): string {
  return `<tg-emoji emoji-id="${id}">${E_FB[id] ?? "•"}</tg-emoji>`;
}

function divider(): string {
  return "〰️〰️〰️〰️〰️〰️〰️〰️〰️";
}

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

async function notifyUsers(message: string): Promise<{ sent: number; failed: number; total: number }> {
  const bot = getBot();
  if (!bot) return { sent: 0, failed: 0, total: 0 };

  const users = await db
    .select({ telegramId: botUsersTable.telegramId })
    .from(botUsersTable)
    .where(eq(botUsersTable.isBanned, false));

  let sent = 0;
  let failed = 0;
  for (const user of users) {
    try {
      await bot.sendMessage(Number(user.telegramId), sc(message), { parse_mode: "HTML" });
      sent++;
    } catch {
      failed++;
    }
    await new Promise((resolve) => setTimeout(resolve, 45));
  }

  return { sent, failed, total: users.length };
}

export async function notifyNewPanel(panelName: string, devices: FirebaseDevice[]): Promise<void> {
  const total = devices.length;
  const online = devices.filter((device) => device.status).length;
  const offline = Math.max(0, total - online);

  const message =
    `${em(E.sms)} <b>NEW INDIAN NUMBERS ADDED</b>\n` +
    `${divider()}\n\n` +
    `${em(E.panel)} <b>PANEL</b>  : ${escapeHtml(panelName)}\n` +
    `${em(E.total)} <b>TOTAL</b>  : ${total}\n` +
    `${em(E.online)} <b>ONLINE</b> : ${online}\n` +
    `${em(E.offline)} <b>OFFLINE</b>: ${offline}\n\n` +
    `${em(E.lightning)} OPEN THE BOT AND TAP <b>GET NUMBER</b> TO USE AVAILABLE NUMBERS.`;

  try {
    const result = await notifyUsers(message);
    logger.info({ result, panelName, total, online, offline }, "New panel notification sent");
  } catch (err) {
    logger.error({ err, panelName }, "Failed to send new panel notification");
  }
}

export async function notifyBulkPanelsAdded(items: Array<{ panelName: string; devices: FirebaseDevice[] }>): Promise<void> {
  const totalPanels = items.length;
  const total = items.reduce((sum, item) => sum + item.devices.length, 0);
  const online = items.reduce((sum, item) => sum + item.devices.filter((device) => device.status).length, 0);
  const offline = Math.max(0, total - online);
  const panelLines = items
    .slice(0, 12)
    .map((item, index) => {
      const itemTotal = item.devices.length;
      const itemOnline = item.devices.filter((device) => device.status).length;
      return `${index + 1}. ${escapeHtml(item.panelName)} - ${itemTotal} TOTAL / ${itemOnline} ONLINE`;
    })
    .join("\n");
  const more = totalPanels > 12 ? `\n+${totalPanels - 12} MORE PANELS ADDED` : "";

  const message =
    `${em(E.sms)} <b>BULK INDIAN NUMBERS ADDED</b>\n` +
    `${divider()}\n\n` +
    `${em(E.panel)} <b>PANELS</b> : ${totalPanels}\n` +
    `${em(E.total)} <b>TOTAL</b>  : ${total}\n` +
    `${em(E.online)} <b>ONLINE</b> : ${online}\n` +
    `${em(E.offline)} <b>OFFLINE</b>: ${offline}\n\n` +
    `${panelLines}${more}\n\n` +
    `${em(E.lightning)} OPEN THE BOT AND TAP <b>GET NUMBER</b> TO USE AVAILABLE NUMBERS.`;

  try {
    const result = await notifyUsers(message);
    logger.info({ result, totalPanels, total, online, offline }, "Bulk panel notification sent");
  } catch (err) {
    logger.error({ err, totalPanels }, "Failed to send bulk panel notification");
  }
}

export async function notifyGiftCardCreated(code: string, type: string, value: number): Promise<void> {
  const unit = type === "credits" ? "credits" : "hours";
  const message =
    `${em(E.gift)} <b>NEW GIFT CARD AVAILABLE</b>\n` +
    `${divider()}\n\n` +
    `${em(E.key)} <b>CODE</b> : <code>${escapeHtml(code)}</code>\n` +
    `${em(E.credits)} <b>VALUE</b>: ${value} ${unit}\n\n` +
    `${em(E.lightning)} OPEN THE BOT AND TAP <b>GIFT CARD</b> TO REDEEM.`;

  try {
    const result = await notifyUsers(message);
    logger.info({ result, code, type, value }, "Gift card notification sent");
  } catch (err) {
    logger.error({ err, code }, "Failed to send gift card notification");
  }
}

export async function notifyCreditsUpdated(telegramId: string, previousCredits: number, nextCredits: number): Promise<void> {
  const diff = nextCredits - previousCredits;
  const action = diff >= 0 ? "CREDITS ADDED" : "CREDITS UPDATED";
  const change = diff >= 0 ? `+${diff}` : String(diff);
  const message =
    `${em(E.check)} <b>${action}</b>\n` +
    `${divider()}\n\n` +
    `${em(E.credits)} <b>CHANGE</b> : ${change} CREDITS\n` +
    `${em(E.total)} <b>BALANCE</b>: ${nextCredits} CREDITS\n\n` +
    `${em(E.lightning)} OPEN THE BOT TO USE YOUR UPDATED BALANCE.`;

  try {
    const bot = getBot();
    if (!bot) return;
    await bot.sendMessage(Number(telegramId), sc(message), { parse_mode: "HTML" });
  } catch (err) {
    logger.warn({ err, telegramId }, "Failed to send credit update notification");
  }
}
