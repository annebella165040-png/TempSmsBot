import { eq } from "drizzle-orm";
import { db, botUsersTable } from "@workspace/db";
import { getBot } from "./bot";
import { logger } from "./logger";
import type { FirebaseDevice } from "./firebase";

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
      await bot.sendMessage(Number(user.telegramId), message, { parse_mode: "HTML" });
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
    `📲 <b>NEW INDIAN NUMBERS ADDED</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🗂 <b>Panel:</b> ${escapeHtml(panelName)}\n` +
    `📊 <b>Total Numbers:</b> ${total}\n` +
    `🟢 <b>Online:</b> ${online}\n` +
    `🔴 <b>Offline:</b> ${offline}\n\n` +
    `⚡ Open the bot and tap <b>GET NUMBER</b> to use available numbers.`;

  try {
    const result = await notifyUsers(message);
    logger.info({ result, panelName, total, online, offline }, "New panel notification sent");
  } catch (err) {
    logger.error({ err, panelName }, "Failed to send new panel notification");
  }
}

export async function notifyGiftCardCreated(code: string, type: string, value: number): Promise<void> {
  const unit = type === "credits" ? "credits" : "hours";
  const message =
    `🎁 <b>NEW GIFT CARD AVAILABLE</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🔑 <b>Code:</b> <code>${escapeHtml(code)}</code>\n` +
    `💎 <b>Value:</b> ${value} ${unit}\n\n` +
    `🚀 Open the bot and tap <b>GIFT CARD</b> to redeem.`;

  try {
    const result = await notifyUsers(message);
    logger.info({ result, code, type, value }, "Gift card notification sent");
  } catch (err) {
    logger.error({ err, code }, "Failed to send gift card notification");
  }
}
