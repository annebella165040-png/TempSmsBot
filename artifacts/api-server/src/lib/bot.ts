import {
  TelegramBot,
  type KeyboardButton,
  type Message,
  type Update,
} from "node-telegram-bot-api";
import { db, botUsersTable, panelsTable, giftCardsTable, referralsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  fetchPanelDevices,
  fetchDeviceSms,
  getLatestSmsTimestamp,
  sendSmsViaFirebase,
  extractPhoneFromSms,
} from "./firebase";
import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";
import { createMiniAppLicense } from "./miniAppLicense";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const BOT_USERNAME  = process.env.BOT_USERNAME  || "AnneBella_Sms_Panel_Bot";
const DEVELOPER     = "@annebella";
const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID || process.env.ADMIN_CHAT_ID || "8210676512";
const FREE_START_CREDITS = 100;
const NUMBER_PURCHASE_CREDITS = 5;
const REFERRAL_REWARD_CREDITS = 20;
const WEB_PANEL_MIN_CREDITS = 1000;
const UPI_ID = "gauravpayout@fam";
const USDT_BINANCE_ID = "1114491025";
const USDT_BEP20_ADDRESS = "0x430b7abc929366ba7c4e3ca26b6c4177590c0c4f";
const USDT_TRC20_ADDRESS = "TDfzW7sn7Hut3uQr6Gnk6TyVN2aG6UoUEn";
const USDT_ERC20_ADDRESS = "0x430b7abc929366ba7c4e3ca26b6c4177590c0c4f";

function cleanBotUsername(username: string): string {
  return username
    .trim()
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^@+/, "")
    .split(/[/?#]/)[0] || "AnneBella_Sms_Panel_Bot";
}

const BOT_LINK_USERNAME = cleanBotUsername(BOT_USERNAME);

// Required channels - order determines 2x2 grid layout
const REQUIRED_CHANNELS = [
  { id: "@indiagates",         label: "ANNEBELLA",     url: "https://t.me/indiagates",         emojiId: "5372849966689566579" },
  { id: "@annebellapanel",     label: "PANEL UPDATES", url: "https://t.me/annebellapanel",     emojiId: "6035152649790164056" },
  { id: "@AnnebellaStorechat", label: "SUPPORT",       url: "https://t.me/AnnebellaStorechat", emojiId: "6026056450223116307" },
  { id: "@AnneBellaForums",    label: "FORUM",         url: "https://t.me/AnneBellaForums",    emojiId: "6203750195130274981" },
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
    // node-telegram-bot-api reports asynchronous Telegram/network failures
    // through events. Without listeners, an invalid token or a transient
    // Railway network failure can terminate the whole Node process.
    bot.on("polling_error", (err: Error) => {
      logger.error({ err }, "Telegram polling error");
    });
    bot.on("error", (err: Error) => {
      logger.error({ err }, "Telegram bot error");
    });
    logger.info("Telegram bot started with polling");
    setupHandlers(bot);
  }
  return bot;
}

export function processUpdate(update: Update): void {
  if (!bot) return;
  bot.processUpdate(update);
}

// â”€â”€â”€ Premium Emoji IDs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const E = {
  lightning:    "5224607267797606837",   // ⚡
  sparkle:      "5289722755871162900",   // ✨
  rocket:       "5372917041193828849",   // ðŸš€
  search:       "5368309348739074032",   // ðŸ”Ž
  signal:       "5352759161945867747",   // (back arrow — used for BACK button)
  a1:           "5445033158456145975",   // new #1 (status)
  buy2:         "5445353829304387411",   // new (buy credit)
  a2:           "5104966345267610825",   // new #2
  a3:           "4918014360267260850",   // new #3
  a4:           "4915842446845281363",   // new #4
  a5:           "4916086774649848789",   // new #5
  profile2:     "5269531045165816230",   // profile button
  search2:      "5893382531037794941",   // search number button
  globe:        "5372849966689566579",   // ðŸŒ
  profile:      "5206318837489743801",   // ðŸ‘¤
  gift:         "5359664288241829619",   // ðŸŽ
  coin:         "5253742260054409879",   // credits/referral
  back:         "5330237710655306682",   // â†©️
  newnum:       "5319160079465857105",   // ðŸ†•
  eye:          "6206155797722830770",   // ðŸ‘
  history:      "6206497372176913599",   // ðŸ“‹
  stop:         "5332296662142434561",   // ðŸ›‘  (verified from adsbot)
  home:         "6204010762206189094",   // ðŸ 
  check:        "6206479140040743133",   // ✅  (verified from adsbot)
  lock:         "6206404510689007446",   // ðŸ”’
  fire:         "6206080502651164081",   // ðŸ”¥
  star:         "6204162490515855272",   // ⭐
  phone:        "6206446249181189526",   // ðŸ“±
  crown:        "6206343625232619150",   // ðŸ‘‘
  money:        "6206378324273403309",   // ðŸ’°
  note:         "6206108815075579644",   // ðŸŽµ
  warn:         "6206174450765796040",   // ⚠️  (verified from adsbot)
  trophy:       "6203750195130274981",   // ðŸ†
  link:         "5339286072876614251",   // ðŸ”—  (verified from adsbot)
  support:      "6026056450223116307",   // ðŸ–¥️
  buy:          "5395358455768837479",   // ðŸ’³
  panel:        "6035152649790164056",   // ðŸ–¥️
  tick:         "5863980370340351884",   // ✔️
  id:           "5404561694510833322",   // ðŸ†”
  name:         "5190806721286657692",   // ðŸ“›
  joined:       "5195033767969839232",   // ðŸ“…
  expire:       "5312361253610475399",   // ⌛
  referral:     "5197269100878907942",   // ðŸ‘¥
  credits:      "5253742260054409879",   // ðŸ’Ž
  online:       "5440621591387980068",   // ðŸŸ¢
  offline:      "6206174450765796040",   // offline/warning
  battery:      "5246772116543512028",   // battery/status details
  india:        "5291933173674957761",   // Indian flag
  sim:          "6269085886177087845",   // ðŸ“²
  random:       "6017187377116614559",   // ðŸŽ²
  status_ok:    "6019476152303750898",   // ðŸ”µ
  wave:         "5247133031235329609",   // ã€°️
  key:          "5249273776079640466",   // ðŸ”‘
  timer:        "5246842176050046092",   // ⏱️
  total:        "5246772116543512028",   // ðŸ“Š
  device:       "5237761614458933049",   // ðŸ“Ÿ
  db:           "5235588635885054955",   // ðŸ—„️
  sms:          "5453900977432188793",   // ðŸ’¬  (verified from adsbot; 5258500422393415126=ðŸ“²)
  refresh:      "5339233635620899144",   // ðŸ”„  (verified from adsbot; 5301096984617166561=ðŸ’µ)
  usdt:         "6035152649790164056",
  binance:      "6035152649790164056",
  upi:          "6019521004647223512",
};

// Unicode fallback for every entry in E — shown to non-Premium users
const E_FB: Record<string, string> = {
  "5224607267797606837": "⚡",
  "5289722755871162900": "✨",
  "5372917041193828849": "🚀",
  "5368309348739074032": "🔎",
  "5352759161945867747": "📶",
  "5372849966689566579": "🌐",
  "5206318837489743801": "👤",
  "5359664288241829619": "🎁",
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
  "6019521004647223512": "💸",
  "5291933173674957761": "🇮🇳",
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
const SC_REVERSE_MAP = Object.fromEntries(Object.entries(SC_MAP).map(([plain, small]) => [small, plain.toLowerCase()]));

function normalizeSmallCaps(text: string): string {
  return text.split("").map((c) => SC_REVERSE_MAP[c] ?? c).join("");
}

function referralFromStartParam(param?: string | null): string | null {
  const normalized = normalizeSmallCaps((param || "").trim());
  return /^ref_\d{4,}$/.test(normalized) ? normalized : null;
}

// HTML-aware small caps: skips tags and literal code/pre content.
function sc(html: string): string {
  let out = "";
  let inTag = false;
  let literalTag: "code" | "pre" | null = null;
  for (let i = 0; i < html.length; i++) {
    const rest = html.slice(i).toLowerCase();
    if (!inTag && rest.startsWith("<code")) literalTag = "code";
    if (!inTag && rest.startsWith("<pre")) literalTag = "pre";
    if (!inTag && rest.startsWith("</code>")) literalTag = null;
    if (!inTag && rest.startsWith("</pre>")) literalTag = null;
    const c = html[i];
    if (c === "<")       { inTag = true;  out += c; }
    else if (c === ">")  { inTag = false; out += c; }
    else if (inTag)      { out += c; }
    else if (literalTag) { out += c; }
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

type KBtn = KeyboardButton & {
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
        btn("SUPPORT ( DEVELOPER )", "danger",  E.support),   // ðŸ–¥
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
        btn("REFER & EARN",          "success", E.referral),  // ðŸ‘¥
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
        btn("WATCH SMS",       "success", E.eye),        // ðŸ‘
      ],
      [
        btn("SMS HISTORY",     "primary", E.history),    // ðŸ“‹
        btn("STOP WATCH",      "danger",  E.stop),       // ðŸ›‘
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
        btn("STOP WATCH",  "danger",  E.stop),     // ðŸ›‘
        btn("SMS HISTORY", "primary", E.history), // ðŸ“‹
      ],
      [
        btn("BACK",        "danger",  E.signal),  // user's back ID
      ],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function developerInlineKeyboard() {
  return {
    inline_keyboard: [[
      iBtn({
        label: "DEVELOPER",
        emojiId: E.support,
        url: "https://t.me/annebella",
        style: "danger",
      }),
    ]],
  };
}

function cancelKeyboard(): CKeyboard {
  return {
    keyboard: [
      [ btn("CANCEL", "danger", E.stop) ],  // ðŸ›‘
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function divider(): string {
  return "〰️〰️〰️〰️〰️〰️〰️〰️〰️〰️";
}

function generateReferralCode(telegramId: string): string {
 return `ref_${telegramId}`;
}

async function getOrCreateUser(msg: Message, referredBy?: string | null) {
  const telegramId = String(msg.from!.id);
  const [existing] = await db
    .select()
    .from(botUsersTable)
    .where(eq(botUsersTable.telegramId, telegramId));

  if (existing) return existing;

  const [user] = await db
    .insert(botUsersTable)
    .values({
      telegramId,
      username: msg.from?.username || null,
      firstName: msg.from?.first_name || "User",
      referralCode: generateReferralCode(telegramId),
      referredBy: referredBy || null,
      smsCredits: FREE_START_CREDITS,
    })
    .returning();

  if (referredBy) {
    const [referrer] = await db
      .select()
      .from(botUsersTable)
      .where(eq(botUsersTable.referralCode, referredBy));

    if (referrer) {
      const newCount = referrer.referralCount + 1;
      const newSmsCredits = referrer.smsCredits + REFERRAL_REWARD_CREDITS;

      await db
        .update(botUsersTable)
        .set({ referralCount: newCount, smsCredits: newSmsCredits })
        .where(eq(botUsersTable.id, referrer.id));

      await db.insert(referralsTable).values({ referrerId: referrer.id, referredTelegramId: telegramId });
    }
  }

  return user;
}

async function hasGetNumberAccess(user: { smsCredits: number }): Promise<boolean> {
  return user.smsCredits >= NUMBER_PURCHASE_CREDITS;
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

// â”€â”€â”€ Raw Telegram HTTP request (bypasses node-telegram-bot-api) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

function stripHtmlToText(html: string): string {
  return html
    .replace(/<tg-emoji[^>]*>(.*?)<\/tg-emoji>/g, "$1")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/?(b|i|u|s|code|pre|a|blockquote|span)[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function withoutParseMode(payload: Record<string, any>): Record<string, any> {
  const p = stripKeyboardIcons(payload);
  p.text = stripHtmlToText(p.text || "");
  delete p.parse_mode;
  return p;
}

// â”€â”€â”€ Inline button with premium emoji via icon_custom_emoji_id (Adsbot style) â”€
// Same field as ReplyKeyboardButton — works on InlineKeyboardButton too when
// sent via raw HTTP.  Button text is clean small-caps only; icon appears left.
function iBtn(opts: {
  label:   string;
  emojiId: string;
  url?:    string;
  webAppUrl?: string;
  cb?:     string;
  copyText?: string;
  style?:  "success" | "danger" | "primary";
}): any {
  const btn: any = {
    text:                sct(opts.label),
    style:               opts.style ?? "success",
    icon_custom_emoji_id: opts.emojiId,
  };
  if (opts.url) btn.url           = opts.url;
  if (opts.webAppUrl) btn.web_app = { url: opts.webAppUrl };
  if (opts.cb)  btn.callback_data  = opts.cb;
  if (opts.copyText) btn.copy_text = { text: opts.copyText };
  return btn;
}

function forceJoinProgress(joinCount: number, total: number): string {
  return `${"■".repeat(joinCount)}${"□".repeat(Math.max(0, total - joinCount))} ${joinCount}/${total}`;
}

function forceJoinMessage(joined: boolean[]): string {
  const joinCount = joined.filter(Boolean).length;
  const total = REQUIRED_CHANNELS.length;
  const missing = REQUIRED_CHANNELS
    .filter((_, index) => !joined[index])
    .map((channel, index) => `${index + 1}. ${channel.label}`)
    .join("\n");

  if (joinCount === total) {
    return (
      `${em(E.check, "")} <b>FORCE JOIN VERIFIED</b>\n${divider()}\n\n` +
      `${em(E.rocket, "")} ALL REQUIRED CHANNELS JOINED.\n` +
      `${em(E.lightning, "")} YOUR BOT ACCESS IS NOW UNLOCKED.`
    );
  }

  return (
    `${em(E.lock, "")} <b>FORCE JOIN REQUIRED</b>\n${divider()}\n\n` +
    `${em(E.globe, "")} <b>JOIN STATUS:</b> ${forceJoinProgress(joinCount, total)}\n` +
    `${em(E.warn, "")} <b>MISSING CHANNELS:</b>\n${missing || "None"}\n\n` +
    `${em(E.link, "")} JOIN ALL REQUIRED CHANNELS TO CONTINUE.\n` +
    `${em(E.refresh, "")} AFTER JOINING, TAP <b>CHECK JOINED</b>.`
  );
}

// Build 2x2 inline channel keyboard with join status + premium emoji
function buildChannelKeyboard(joined: boolean[], allJoined: boolean): { inline_keyboard: any[][] } {
  const rows: any[][] = [];
  for (let i = 0; i < REQUIRED_CHANNELS.length; i += 2) {
    const row: any[] = [];
    for (let j = i; j < Math.min(i + 2, REQUIRED_CHANNELS.length); j++) {
      const ch = REQUIRED_CHANNELS[j];
      const ok = joined[j];
      row.push(iBtn({
        label:   `${ok ? "JOINED" : "JOIN"} - ${ch.label}`,
        emojiId: ch.emojiId,
        url:     ch.url,
        style:   "success",
      }));
    }
    rows.push(row);
  }

  rows.push([
    iBtn({
      label:   allJoined ? "ENTER BOT" : "CHECK JOINED",
      emojiId: allJoined ? E.rocket : E.check,
      cb:      "check_joined",
      style:   allJoined ? "success" : "primary",
    }),
    iBtn({
      label:   "REFRESH",
      emojiId: E.refresh,
      cb:      "check_joined",
      style:   "primary",
    }),
  ]);
  rows.push([iBtn({
    label:   "SUPPORT",
    emojiId: E.support,
    url:     "https://t.me/AnnebellaStorechat",
    style:   "danger",
  })]);
  return { inline_keyboard: rows };
}

// â”€â”€â”€ Numbers History (file-based, like PHP bot) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// Eligible devices = online (status true) AND at least one SMS received in the
// last hour. The SMS timestamp is the source of truth; an unknown timestamp is
// not treated as recent.
async function getAllActiveDevices() {
  const panels = await db.select().from(panelsTable);
  const all = [];
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const panel of panels) {
    const devices = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
    const onlineDevices = devices.filter((device) => device.status);
    const eligible = await Promise.all(
      onlineDevices.map(async (device) => {
        let latestSmsTimestamp = device.lastSmsTimestampMs;

        // Some panel versions keep SMS under a separate path instead of
        // embedding it in clients/{deviceId}. Fall back to those paths, but
        // never fall back to status alone.
        if (latestSmsTimestamp === null) {
          const messages = await fetchDeviceSms(
            panel.firebaseUrl,
            panel.secretKey,
            device.id,
          );
          latestSmsTimestamp = getLatestSmsTimestamp(messages);
          device.lastSmsTimestampMs = latestSmsTimestamp;
        }

        return latestSmsTimestamp !== null && latestSmsTimestamp >= oneHourAgo
          ? device
          : null;
      }),
    );
    all.push(...eligible.filter((device): device is (typeof devices)[number] => device !== null));
  }
  return all;
}

// Watch polling: userId → intervalId
const watchIntervals = new Map<string, NodeJS.Timeout>();
type WatchCursor = { key: string; timestampMs: number | null };
const watchLastSms = new Map<string, WatchCursor>();

function getSmsKey(message: { sender: string; text: string; time: string }): string {
  return `${message.sender}:${message.text}:${message.time}`;
}

function extractOtpFromText(text: string): string | null {
  const preferred = text.match(/(?:otp|code|verification code|whatsapp code)[^0-9]*(\d[\d\s-]{2,14}\d)/i);
  const raw = preferred?.[1] ?? text.match(/\b(\d{3}[-\s]\d{3})\b/)?.[1] ?? text.match(/\b(\d{4,8})\b/)?.[1];
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 4 && digits.length <= 8 ? digits : null;
}

function escapeTelegramHtml(value: string): string {
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

function welcomeMessage(firstName: string, credits: number): string {
  return (
    `${em(E.lightning, "")} <b>ANNEBELLA SMS BOT</b> ${em(E.sparkle, "")}\n` +
    `${divider()}\n\n` +
    `${em(E.sparkle, "")} <b>WELCOME, ${escapeTelegramHtml(firstName)}!</b>\n\n` +
    `${em(E.india, "")} <b>GET REAL INDIAN VIRTUAL NUMBERS</b>\n` +
    `<i>SIM-based numbers with full SMS access.</i>\n\n` +
    `${divider()}\n\n` +
    `${em(E.fire, "")} <b>WHY ANNEBELLA?</b>\n\n` +
    `${em(E.sim, "")} REAL INDIAN NUMBERS - 6 TO 9 SERIES\n` +
    `${em(E.sms, "")} LIVE SMS ON THE SAME NUMBER\n` +
    `${em(E.refresh, "")} FAST OTP DELIVERY IN SECONDS\n` +
    `${em(E.lock, "")} PRIVATE AND SECURE ACCESS\n` +
    `${em(E.gift, "")} START FREE - NO CARD NEEDED\n\n` +
    `${divider()}\n\n` +
    `${em(E.credits, "")} <b>FREE SIGNUP BONUS</b>\n` +
    `${credits} CREDITS AVAILABLE IN YOUR ACCOUNT.\n\n` +
    `${em(E.coin, "")} <b>CREDITS PLAN</b>\n` +
    `${em(E.phone, "")} GET NUMBER  →  <b>${NUMBER_PURCHASE_CREDITS} CREDITS</b>\n` +
    `${em(E.referral, "")} REFER FRIEND →  <b>${REFERRAL_REWARD_CREDITS} CREDITS</b>\n\n` +
    `${divider()}\n\n` +
    `${em(E.rocket, "")} <i>CHOOSE AN OPTION FROM THE MENU BELOW.</i>`
  );
}

type NumberCreditState = {
  numberCreditCharged?: boolean;
  liveSmsReceived?: boolean;
};

type PendingCreditPayment = {
  type: "credit_payment";
  credits: number;
  price: number | null;
  method?: "upi" | "usdt";
};

function parseStateData<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function paymentQrUrl(credits: number, price: number | null): string {
  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: "Gaurav",
    cu: "INR",
    tn: `AnneBella ${credits} Credits`,
  });
  if (price !== null) params.set("am", String(price));
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(`upi://pay?${params.toString()}`)}`;
}

function paymentMethodKeyboard(): { inline_keyboard: any[][] } {
  return {
    inline_keyboard: [
      [
        iBtn({ label: "UPI", emojiId: E.upi, cb: "paymethod_upi", style: "success" }),
        iBtn({ label: "USDT", emojiId: E.usdt, cb: "paymethod_usdt", style: "primary" }),
      ],
    ],
  };
}

function usdtKeyboard(): { inline_keyboard: any[][] } {
  return {
    inline_keyboard: [
      [
        iBtn({ label: "BINANCE ID", emojiId: E.binance, copyText: USDT_BINANCE_ID, style: "success" }),
        iBtn({ label: "TRC20", emojiId: E.star, copyText: USDT_TRC20_ADDRESS, style: "primary" }),
      ],
      [
        iBtn({ label: "BEP20", emojiId: E.star, copyText: USDT_BEP20_ADDRESS, style: "success" }),
        iBtn({ label: "ERC20", emojiId: E.star, copyText: USDT_ERC20_ADDRESS, style: "danger" }),
      ],
    ],
  };
}

function paymentMethodMessage(pending: PendingCreditPayment): string {
  return (
    `${em(E.buy, "")} <b>SELECT PAYMENT METHOD</b>\n${divider()}\n\n` +
    `${em(E.credits, "")} <b>PACKAGE:</b> ${pending.credits} CREDITS\n` +
    `${em(E.money, "")} <b>AMOUNT:</b> ${pending.price !== null ? `₹${pending.price}` : "CUSTOM / MANUAL"}\n\n` +
    `${em(E.upi, "")} UPI QR ke liye <b>UPI</b> dabao.\n` +
    `${em(E.usdt, "")} USDT address ke liye <b>USDT</b> dabao.`
  );
}

function numberState(liveSmsReceived = false): string {
  return JSON.stringify({ numberCreditCharged: true, liveSmsReceived } satisfies NumberCreditState);
}

async function refundNumberCreditIfUnused(user: { id: number; smsCredits: number; stateData: string | null }) {
  const data = parseStateData<NumberCreditState>(user.stateData);
  if (!data?.numberCreditCharged || data.liveSmsReceived) return user.smsCredits;
  const refundedCredits = user.smsCredits + NUMBER_PURCHASE_CREDITS;
  await db
    .update(botUsersTable)
    .set({
      smsCredits: refundedCredits,
      assignedDeviceId: null,
      assignedPanelId: null,
      stateData: null,
    })
    .where(eq(botUsersTable.id, user.id));
  return refundedCredits;
}

// â”€â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        const noIcons = await rawTelegramRequest("sendMessage", stripKeyboardIcons(payload));
        if (!noIcons.ok) {
          return rawTelegramRequest("sendMessage", withoutParseMode(payload));
        }
        return noIcons;
      }
      return result;
    }
    try {
      return await bot.sendMessage(cid, sc(html), { parse_mode: "HTML", ...opts });
    } catch (err) {
      logger.warn({ err }, "HTML message failed, retrying as plain text");
      const plainOpts: Record<string, any> = { ...opts };
      delete plainOpts.parse_mode;
      return bot.sendMessage(cid, stripHtmlToText(sc(html)), plainOpts);
    }
  };

  const sendPhoto = async (cid: number | string, photo: string, opts: Record<string, any> = {}) => {
    try {
      const htmlOpts = opts.caption && opts.parse_mode === "HTML" ? { ...opts, caption: sc(opts.caption) } : opts;
      return await bot.sendPhoto(cid, photo, htmlOpts);
    } catch (err) {
      if (!opts.caption || opts.parse_mode !== "HTML") throw err;
      logger.warn({ err }, "HTML photo caption failed, retrying as plain text");
      const plainOpts: Record<string, any> = { ...opts, caption: stripHtmlToText(sc(opts.caption)) };
      delete plainOpts.parse_mode;
      return bot.sendPhoto(cid, photo, plainOpts);
    }
  };

  const extractMessageId = (sent: any): number | null => {
    const messageId = sent?.message_id ?? sent?.result?.message_id;
    return typeof messageId === "number" ? messageId : null;
  };

  const pinPrivateMessage = async (chatId: number, sent: any) => {
    if (chatId < 0) return;
    const messageId = extractMessageId(sent);
    if (!messageId) return;
    try {
      const result = await rawTelegramRequest("pinChatMessage", {
        chat_id: chatId,
        message_id: messageId,
        disable_notification: true,
      });
      if (!result.ok) logger.warn({ chatId, description: result.description }, "Private welcome pin failed");
    } catch (err) {
      logger.warn({ err, chatId }, "Private welcome pin failed");
    }
  };

  const sendPaymentProofToOwner = async (
    proofMessage: Message,
    user: typeof botUsersTable.$inferSelect,
    pending: PendingCreditPayment,
  ) => {
    const caption =
      `${em(E.buy, "")} <b>BUY CREDIT REQUEST</b>\n${divider()}\n\n` +
      `${em(E.profile, "")} <b>USER:</b> ${escapeTelegramHtml(user.firstName)}\n` +
      `${em(E.id, "")} <b>ID:</b> <code>${user.telegramId}</code>\n` +
      `${em(E.link, "")} <b>USERNAME:</b> ${user.username ? `@${escapeTelegramHtml(user.username)}` : "N/A"}\n` +
      `${em(E.credits, "")} <b>PACKAGE:</b> ${pending.credits} CREDITS\n` +
      `${em(pending.method === "usdt" ? E.usdt : E.coin, "")} <b>METHOD:</b> ${(pending.method || "upi").toUpperCase()}\n` +
      `${em(E.money, "")} <b>AMOUNT:</b> ${pending.price !== null ? `₹${pending.price}` : "CUSTOM / MANUAL"}`;

    const reply_markup = {
      inline_keyboard: [[
        iBtn({ label: "APPROVE", emojiId: E.check, cb: `pay_approve_${user.telegramId}_${pending.credits}`, style: "success" }),
        iBtn({ label: "DECLINE", emojiId: E.warn, cb: `pay_decline_${user.telegramId}_${pending.credits}`, style: "danger" }),
      ]],
    };

    try {
      await bot.copyMessage(OWNER_CHAT_ID, proofMessage.chat.id, proofMessage.message_id, {
        caption: sc(caption),
        parse_mode: "HTML",
        reply_markup,
      } as any);
    } catch (err) {
      logger.warn({ err, ownerChatId: OWNER_CHAT_ID, userId: user.telegramId }, "HTML payment proof copy failed, retrying as plain text");
      await bot.copyMessage(OWNER_CHAT_ID, proofMessage.chat.id, proofMessage.message_id, {
        caption: stripHtmlToText(sc(caption)),
        reply_markup,
      } as any);
    }
  };

  bot.on("message", async (msg) => {
    const chatId     = msg.chat.id;

    if (msg.pinned_message && msg.chat.type === "private") {
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (err) {
        logger.info({ err, chatId }, "Could not delete private pin service notice");
      }
      return;
    }

    if (!msg.from) return;
    const text       = msg.text?.trim() || "";
    const telegramId = String(msg.from.id);

    try {
      // â”€â”€ /start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (text.startsWith("/start")) {
        const param      = text.split(/\s+/)[1] || null;
        const referredBy = referralFromStartParam(param);
        const user = await getOrCreateUser(msg, referredBy);

        // Check which channels user has already joined
        const joined    = await checkMembership(bot, telegramId);
        const joinCount = joined.filter(Boolean).length;
        const total     = REQUIRED_CHANNELS.length;
        const allJoined = joinCount === total;

        if (allJoined) {
          const welcome = await send(
            chatId,
            welcomeMessage(user.firstName, user.smsCredits),
            { parse_mode: "HTML", reply_markup: { remove_keyboard: true } }
          );
          await pinPrivateMessage(chatId, welcome);
          await send(
            chatId,
            forceJoinMessage(joined),
            { parse_mode: "HTML" }
          );
          await send(
            chatId,
 `${em(E.lightning, "")} <b>BOT READY! USE THE BUTTONS BELOW.</b>`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
        } else {
          await send(
            chatId,
            forceJoinMessage(joined),
            { parse_mode: "HTML", reply_markup: buildChannelKeyboard(joined, false) }
          );
        }
        return;
      }

      // â”€â”€ Fetch user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const [user] = await db
        .select()
        .from(botUsersTable)
        .where(eq(botUsersTable.telegramId, telegramId));

      if (!user) {
        await send(chatId, "PLEASE SEND /start TO BEGIN.");
        return;
      }

      const liveJoined = await checkMembership(bot, telegramId);
      const liveAllJoined = liveJoined.every(Boolean);
      if (!liveAllJoined) {
        await send(
          chatId,
          forceJoinMessage(liveJoined),
          { parse_mode: "HTML", reply_markup: buildChannelKeyboard(liveJoined, false) }
        );
        return;
      }

      if (user.state === "pending_credit_payment") {
        if (text === sct("BACK") || text === sct("CANCEL")) {
          await db.update(botUsersTable).set({ state: "main_menu", stateData: null }).where(eq(botUsersTable.id, user.id));
          await send(chatId, `${em(E.lightning, "")} <b>MAIN MENU</b>`, { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any });
          return;
        }

        const pending = parseStateData<PendingCreditPayment>(user.stateData);
        if (!pending || pending.type !== "credit_payment") {
          await db.update(botUsersTable).set({ state: "main_menu", stateData: null }).where(eq(botUsersTable.id, user.id));
          await send(chatId, `${em(E.warn, "")} PAYMENT SESSION EXPIRED. BUY CREDIT DOBARA TRY KARO.`, { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any });
          return;
        }

        if (!msg.photo?.length && !msg.document) {
          await send(
            chatId,
            `${em(E.buy, "")} <b>PAYMENT SCREENSHOT BHEJO.</b>\n\n` +
            `PACKAGE: <b>${pending.credits} CREDITS</b>` +
            (pending.price !== null ? `\nAMOUNT: <b>₹${pending.price}</b>` : ""),
            { parse_mode: "HTML", reply_markup: cancelKeyboard() as any }
          );
          return;
        }

        let ownerNotified = false;
        try {
          await sendPaymentProofToOwner(msg, user, pending);
          ownerNotified = true;
        } catch (err) {
          logger.error({ err, ownerChatId: OWNER_CHAT_ID, userId: user.telegramId }, "Failed to notify owner about credit payment");
        }

        await db.update(botUsersTable).set({ state: "main_menu", stateData: null }).where(eq(botUsersTable.id, user.id));
        await send(
          chatId,
          `${em(E.check, "")} <b>SCREENSHOT RECEIVED</b>\n${divider()}\n\n` +
          `${em(E.refresh, "")} ${ownerNotified ? "YOUR PAYMENT IS UNDER REVIEW." : "OWNER NOTIFICATION FAILED. PLEASE CONTACT SUPPORT."}\n` +
          `${em(E.credits, "")} CREDITS WILL BE ADDED AFTER OWNER APPROVAL.`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
        );
        return;
      }

      // â”€â”€ Main menu navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

      if (text === sct("GET NUMBER")) {
        const hasAccess = await hasGetNumberAccess(user);
        if (!hasAccess) {
          await send(
            chatId,
 `${em(E.expire, "")} <b>INSUFFICIENT CREDITS!</b>\n\n` +
            `NUMBER PURCHASE KE LIYE <b>${NUMBER_PURCHASE_CREDITS} CREDITS</b> CHAHIYE.\n` +
            `${em(E.credits, "")} AAPKE CREDITS: <b>${user.smsCredits}</b>\n\n` +
            `REFER & EARN YA BUY CREDIT USE KARO.`,
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
        const creditsAfterPurchase = user.smsCredits - NUMBER_PURCHASE_CREDITS;

        await db
          .update(botUsersTable)
          .set({
            assignedDeviceId: device.id,
            assignedPanelId: device.panelId,
            smsCredits: creditsAfterPurchase,
            state: "number_menu",
            stateData: numberState(false),
          })
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
          `${em(E.credits, "")} CREDITS REMAINING: <b>${creditsAfterPurchase}</b>\n` +
          `${em(E.refresh, "")} CANCEL BEFORE LIVE SMS = ${NUMBER_PURCHASE_CREDITS} CREDITS REFUND\n` +
          `${em(E.history, "")} NUMBERS HISTORY MEIN SAVED — ANYTIME DEKHO.`,
          { parse_mode: "HTML", reply_markup: numberMenuKeyboard() as any }
        );
        return;
      }

      if (text === sct("NEW NUMBER")) {
        const currentCredits = await refundNumberCreditIfUnused(user);
        if (currentCredits < NUMBER_PURCHASE_CREDITS) {
          await send(
            chatId,
 `${em(E.expire, "")} <b>INSUFFICIENT CREDITS!</b>\n\n` +
            `NEW NUMBER KE LIYE <b>${NUMBER_PURCHASE_CREDITS} CREDITS</b> CHAHIYE.\n` +
            `${em(E.credits, "")} AAPKE CREDITS: <b>${currentCredits}</b>`,
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
        const creditsAfterPurchase2 = currentCredits - NUMBER_PURCHASE_CREDITS;

        await db
          .update(botUsersTable)
          .set({
            assignedDeviceId: device2.id,
            assignedPanelId: device2.panelId,
            smsCredits: creditsAfterPurchase2,
            stateData: numberState(false),
          })
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
          `${em(E.credits, "")} CREDITS REMAINING: <b>${creditsAfterPurchase2}</b>\n` +
          `${em(E.refresh, "")} CANCEL BEFORE LIVE SMS = ${NUMBER_PURCHASE_CREDITS} CREDITS REFUND\n` +
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

        // Seed the cursor with the newest message that already exists. Without
        // this, the first 10-second poll forwards an old SMS as "LIVE".
        const initialMessages = await fetchDeviceSms(
          panel.firebaseUrl,
          panel.secretKey,
          user.assignedDeviceId,
        );
        const initialLatest = initialMessages[0];
        if (initialLatest) {
          watchLastSms.set(telegramId, {
            key: getSmsKey(initialLatest),
            timestampMs: initialLatest.timestampMs,
          });
        } else {
          watchLastSms.delete(telegramId);
        }

        const intervalId = setInterval(async () => {
          try {
            const msgs = await fetchDeviceSms(panel.firebaseUrl, panel.secretKey, user.assignedDeviceId!);
            if (msgs.length === 0) return;
            const latest = msgs[0];
            const key = getSmsKey(latest);
            const cursor = watchLastSms.get(telegramId);
            if (!cursor) {
              watchLastSms.set(telegramId, {
                key,
                timestampMs: latest.timestampMs,
              });
              return;
            }

            const isNewSms =
              latest.timestampMs !== null && cursor.timestampMs !== null
                ? latest.timestampMs > cursor.timestampMs
                : key !== cursor.key;

            if (isNewSms) {
              watchLastSms.set(telegramId, {
                key,
                timestampMs: latest.timestampMs,
              });
              await db
                .update(botUsersTable)
                .set({ stateData: numberState(true) })
                .where(eq(botUsersTable.id, user.id));
              const otp = extractOtpFromText(latest.text);
              await send(
                chatId,
 `${em(E.sms, "")} <b>LIVE SMS RECEIVED!</b>\n` +
                `${divider()}\n\n` +
                 `${em(E.phone, "")} <b>From:</b> <code>${escapeTelegramHtml(latest.sender)}</code>\n` +
                 `${em(E.timer, "")} <b>Time:</b> ${escapeTelegramHtml(latest.time || "—")}\n\n` +
                 `${em(E.history, "")} <b>Message:</b>\n<code>${escapeTelegramHtml(latest.text)}</code>` +
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
        // Send every latest SMS separately so long WhatsApp/bank messages are
        // not cropped inside one Telegram message.
        const top5 = messages.slice(0, 5);
        await send(
          chatId,
 `${em(E.history, "")} <b>SMS HISTORY</b> (${messages.length} total, showing 5 latest)\n${divider()}`,
          { parse_mode: "HTML" }
        );
        for (let i = 0; i < top5.length; i++) {
          const m = top5[i];
          const otp = extractOtpFromText(m.text);
          await send(
            chatId,
            `<b>${i + 1}. ${escapeTelegramHtml(m.sender)}</b>\n` +
            `${em(E.timer, "")} ${escapeTelegramHtml(m.time || "—")}\n` +
            `${divider()}\n` +
            `<code>${escapeTelegramHtml(m.text.slice(0, 2800))}</code>` +
            (otp ? `\n\n${em(E.key, "")} <b>OTP: <code>${otp}</code></b>` : ""),
            { parse_mode: "HTML", reply_markup: i === top5.length - 1 ? numberMenuKeyboard() as any : undefined }
          );
        }
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
        const activeRate = totalDevices > 0 ? Math.round((totalOnline / totalDevices) * 100) : 0;

        await send(
          chatId,
 `${em(E.check, "")} <b>STATUS REPORT</b>\n` +
          `${divider()}\n\n` +
          `${em(E.panel, "")} <b>CONNECTED PANELS</b> : ${panels.length}\n` +
          `${em(E.total, "")} <b>TOTAL DEVICES</b>    : ${totalDevices}\n` +
          `${em(E.online, "")} <b>ONLINE DEVICES</b>   : ${totalOnline}\n` +
          `${em(E.offline, "")} <b>OFFLINE DEVICES</b>  : ${totalOffline}\n` +
          `${em(E.status_ok, "")} <b>ACTIVE RATE</b>      : ${activeRate}%\n\n` +
          `${divider()}\n` +
          `${em(E.refresh, "")} <b>LIVE INVENTORY</b>\n` +
          `Numbers are refreshed directly from all connected Firebase panels.\n` +
          `Use <b>GET NUMBER</b> to receive an active number instantly.`,
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
        const numberStatus = user.smsCredits >= NUMBER_PURCHASE_CREDITS
          ? `${em(E.check, "")} READY - ${user.smsCredits} credits`
          : `${em(E.lock, "")} NEED ${NUMBER_PURCHASE_CREDITS - user.smsCredits} MORE CREDITS`;

        const webStatus = user.smsCredits >= WEB_PANEL_MIN_CREDITS
          ? `${em(E.check, "")} READY - ${user.smsCredits} credits`
          : `${em(E.lock, "")} NEED ${WEB_PANEL_MIN_CREDITS - user.smsCredits} MORE CREDITS`;

 const referralLink = `https://t.me/${BOT_LINK_USERNAME}?start=${user.referralCode}`;

        await send(
          chatId,
 `${em(E.coin, "")} <b>REFERRAL SYSTEM</b>\n` +
          `${divider()}\n\n` +
          `${em(E.link, "")} <b>AAPKA REFERRAL LINK:</b>\n` +
 `<code>${referralLink}</code>\n\n` +
          `${divider()}\n` +
          `${em(E.coin, "")} <b>TOTAL REFERRALS:</b> ${user.referralCount}\n\n` +
          `${em(E.lightning, "")} <b>GET NUMBER</b>\n${numberStatus}\n\n` +
          `${em(E.panel, "")} <b>WEB PANEL</b>\n${webStatus}\n\n` +
          `${divider()}\n` +
          `${em(E.star, "")} <b>RULES:</b>\n` +
          `• NEW USER = ${FREE_START_CREDITS} FREE CREDITS\n` +
          `• 1 NUMBER PURCHASE = ${NUMBER_PURCHASE_CREDITS} CREDITS\n` +
          `• HAR REFERRAL = +${REFERRAL_REWARD_CREDITS} CREDITS\n` +
          `• WEB PANEL = ${WEB_PANEL_MIN_CREDITS} CREDITS REQUIRED`,
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
        if (user.smsCredits < WEB_PANEL_MIN_CREDITS) {
          await send(
            chatId,
 `${em(E.lock, "")} <b>WEB PANEL — LOCKED!</b>\n\n` +
            `${em(E.star, "")} WEB PANEL OPEN KARNE KE LIYE <b>${WEB_PANEL_MIN_CREDITS} CREDITS</b> CHAHIYE.\n\n` +
            `${em(E.credits, "")} AAPKE CREDITS: <b>${user.smsCredits}</b>\n` +
            `${em(E.coin, "")} NEED: <b>${WEB_PANEL_MIN_CREDITS - user.smsCredits}</b> MORE CREDITS`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          );
          return;
        }

        const configuredUrl = process.env.PUBLIC_APP_URL?.trim();
        const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
        const baseUrl = configuredUrl
          ? configuredUrl.replace(/\/+$/, "")
          : railwayDomain
            ? `https://${railwayDomain.replace(/\/+$/, "")}`
            : "https://your-railway-domain.up.railway.app";
        const now = new Date();
        const currentExpiry = user.webPanelExpiresAt && user.webPanelExpiresAt > now
          ? user.webPanelExpiresAt
          : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        await db
          .update(botUsersTable)
          .set({ webPanelExpiresAt: currentExpiry })
          .where(eq(botUsersTable.id, user.id));
        const license = createMiniAppLicense(user.telegramId, currentExpiry);
        const webUrl = `${baseUrl}/miniapp?license=${encodeURIComponent(license)}`;

        await send(
          chatId,
 `${em(E.check, "")} <b>WEB PANEL ACCESS GRANTED!</b>\n\n` +
          `${em(E.credits, "")} CREDITS: <b>${user.smsCredits}</b>\n` +
          `${em(E.timer, "")} LICENSE VALID: <b>1 MONTH</b>\n` +
          `${em(E.link, "")} NICHE BUTTON SE MINI APP OPEN KARO.`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [iBtn({ label: "OPEN MINI APP", emojiId: E.panel, webAppUrl: webUrl, style: "primary" })],
              ],
            },
          }
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
        const getNum = user.smsCredits >= NUMBER_PURCHASE_CREDITS
          ? `READY - ${NUMBER_PURCHASE_CREDITS} credits per number`
          : `LOW CREDITS - need ${NUMBER_PURCHASE_CREDITS - user.smsCredits} more`;
        const webPanel = user.smsCredits >= WEB_PANEL_MIN_CREDITS
          ? `READY - 1 month license available`
          : `LOCKED - need ${WEB_PANEL_MIN_CREDITS - user.smsCredits} more credits`;
        const sendSms = user.sendSmsUnlocked ? `UNLOCKED - outbound SMS enabled` : `LOCKED - complete referral requirement`;
        const usernameLine = user.username ? `@${escapeTelegramHtml(user.username)}` : "Not connected";

        await send(
          chatId,
 `${em(E.profile, "")} <b>MY PROFILE</b>\n` +
          `${divider()}\n\n` +
          `${em(E.name, "")} <b>NAME</b>       : ${escapeTelegramHtml(user.firstName)}\n` +
          `${em(E.link, "")} <b>USERNAME</b>   : ${usernameLine}\n` +
          `${em(E.id, "")} <b>TELEGRAM ID</b> : <code>${user.telegramId}</code>\n` +
          `${em(E.joined, "")} <b>JOINED ON</b>   : ${user.createdAt?.toLocaleDateString("en-IN") || "N/A"}\n` +
          `${divider()}\n\n` +
          `${em(E.lightning, "")} <b>GET NUMBER ACCESS</b>\n${getNum}\n\n` +
          `${em(E.panel, "")} <b>WEB PANEL ACCESS</b>\n${webPanel}\n\n` +
          `${em(E.phone, "")} <b>SEND SMS ACCESS</b>\n${sendSms}\n` +
          `${divider()}\n\n` +
          `${em(E.referral, "")} <b>TOTAL REFERRALS</b> : ${user.referralCount}\n` +
          `${em(E.credits, "")} <b>AVAILABLE CREDITS</b> : ${user.smsCredits}\n\n` +
          `${em(E.refresh, "")} Referral rewards and approved payments are added automatically.`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
        );
        return;
      }

      if (text === sct("BUY CREDIT")) {
        await send(
          chatId,
          `${em(E.buy, "")} <b>BUY CREDITS</b>\n` +
          `${divider()}\n\n` +
          `${em(E.credits, "")} <b>SELECT A CREDIT PACKAGE</b>\n` +
          `Package select karne ke baad payment method choose karo: UPI ya USDT.\n\n` +
          `${em(E.money, "")} 100 CREDITS — ₹49\n` +
          `${em(E.money, "")} 500 CREDITS — ₹199\n` +
          `${em(E.money, "")} 1000 CREDITS — ₹349\n` +
          `${em(E.money, "")} 5000 CREDITS — ₹999\n\n` +
          `${em(E.history, "")} Payment complete karke screenshot yahi bot mein bhejo for approval.`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  iBtn({ label: "100 CREDITS", emojiId: E.credits, cb: "buy_100", style: "success" }),
                  iBtn({ label: "500 CREDITS", emojiId: E.money, cb: "buy_500", style: "primary" }),
                ],
                [
                  iBtn({ label: "1000 CREDITS", emojiId: E.crown, cb: "buy_1000", style: "success" }),
                  iBtn({ label: "5000 CREDITS", emojiId: E.fire, cb: "buy_5000", style: "danger" }),
                ],
                [
                  iBtn({ label: "CUSTOM CREDITS", emojiId: E.buy, cb: "buy_custom", style: "primary" }),
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
 `${em(E.support, "")} <b>SUPPORT</b>\n` +
          `${divider()}\n\n` +
          `${em(E.warn, "")} Need help with credits, numbers, OTP, or web panel access?\n\n` +
          `${em(E.link, "")} Contact developer: ${DEVELOPER}`,
          { parse_mode: "HTML", reply_markup: developerInlineKeyboard() as any }
        );
        return;
      }

      if (text === sct("BACK") || text === sct("CANCEL")) {
        const iv = watchIntervals.get(telegramId);
        if (iv) { clearInterval(iv); watchIntervals.delete(telegramId); watchLastSms.delete(telegramId); }
        const creditsAfterRefund = await refundNumberCreditIfUnused(user);
        await db.update(botUsersTable).set({ state: "main_menu", stateData: null }).where(eq(botUsersTable.id, user.id));
        await send(
          chatId,
 `${em(E.lightning, "")} <b>MAIN MENU</b>\n\n${em(E.credits, "")} CREDITS: <b>${creditsAfterRefund}</b>`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
        );
        return;
      }

      // â”€â”€ State-based text inputs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

      if (user.state === "custom_credit_amount") {
        const credits = parseInt(text.replace(/\D/g, ""), 10);
        if (!Number.isFinite(credits) || credits <= 0) {
          await send(chatId, `${em(E.warn, "")} VALID CREDIT AMOUNT SEND KARO. EXAMPLE: <code>250</code>`, { parse_mode: "HTML", reply_markup: cancelKeyboard() as any });
          return;
        }

        const pending: PendingCreditPayment = { type: "credit_payment", credits, price: null };
        await db
          .update(botUsersTable)
          .set({ state: "pending_credit_method", stateData: JSON.stringify(pending) })
          .where(eq(botUsersTable.id, user.id));

        await send(chatId, paymentMethodMessage(pending), { parse_mode: "HTML", reply_markup: paymentMethodKeyboard() as any });
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

  // â”€â”€ Callback query (inline buttons) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        await safeAnswer("Checking join status...");

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
              text:         sc(forceJoinMessage(joined)),
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
          const [newUser] = await db.insert(botUsersTable).values({
            telegramId,
            username:           query.from.username || null,
            firstName:          query.from.first_name || "User",
            referralCode:       generateReferralCode(telegramId),
            referredBy:         null,
            smsCredits:         FREE_START_CREDITS,
          }).returning();
          user = newUser;
        }

        // Delete the force-join verification message — it's no longer needed
        try {
          await bot.deleteMessage(chatId, query.message.message_id);
        } catch { /* ignore if already deleted */ }

        const welcome = await send(
          chatId,
          welcomeMessage(user.firstName, user.smsCredits),
          { parse_mode: "HTML", reply_markup: { remove_keyboard: true } }
        );
        await pinPrivateMessage(chatId, welcome);

        await send(
          chatId,
          forceJoinMessage(joined),
          { parse_mode: "HTML" }
        );

        await send(
          chatId,
 `${em(E.lightning, "")} <b>BOT READY! USE THE BUTTONS BELOW.</b>`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
        );
        return;
      }

      if (!data.startsWith("pay_") && data !== "noop") {
        const joined = await checkMembership(bot, telegramId);
        if (!joined.every(Boolean)) {
          await safeAnswer("Join required");
          try {
            const editPayload = {
              chat_id:      chatId,
              message_id:   query.message.message_id,
              text:         sc(forceJoinMessage(joined)),
              parse_mode:   "HTML",
              reply_markup: buildChannelKeyboard(joined, false),
            };
            const r = await rawTelegramRequest("editMessageText", editPayload);
            if (!r.ok) await rawTelegramRequest("editMessageText", stripKeyboardIcons(editPayload));
          } catch {
            await send(
              chatId,
              forceJoinMessage(joined),
              { parse_mode: "HTML", reply_markup: buildChannelKeyboard(joined, false) }
            );
          }
          return;
        }
      }

      if (data === "buy_custom") {
        await safeAnswer("Custom credits");
        const [user] = await db.select().from(botUsersTable).where(eq(botUsersTable.telegramId, telegramId));
        if (!user) return;
        await db.update(botUsersTable).set({ state: "custom_credit_amount", stateData: null }).where(eq(botUsersTable.id, user.id));
        await send(
          chatId,
          `${em(E.buy, "")} <b>CUSTOM CREDITS</b>\n${divider()}\n\nCREDIT AMOUNT SEND KARO.\nEXAMPLE: <code>250</code>`,
          { parse_mode: "HTML", reply_markup: cancelKeyboard() as any }
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
        await bot.answerCallbackQuery(query.id, { text: "Payment method choose karo" });
        const [user] = await db.select().from(botUsersTable).where(eq(botUsersTable.telegramId, telegramId));
        if (!user) return;
        const pending: PendingCreditPayment = { type: "credit_payment", credits: pkg.credits, price: pkg.price };
        await db
          .update(botUsersTable)
          .set({ state: "pending_credit_method", stateData: JSON.stringify(pending) })
          .where(eq(botUsersTable.id, user.id));

        await send(chatId, paymentMethodMessage(pending), { parse_mode: "HTML", reply_markup: paymentMethodKeyboard() as any });
        return;
      }

      if (data === "paymethod_upi" || data === "paymethod_usdt") {
        await safeAnswer(data === "paymethod_upi" ? "UPI selected" : "USDT selected");
        const [user] = await db.select().from(botUsersTable).where(eq(botUsersTable.telegramId, telegramId));
        if (!user) return;
        const pending = parseStateData<PendingCreditPayment>(user.stateData);
        if (user.state !== "pending_credit_method" || !pending || pending.type !== "credit_payment") {
          await send(chatId, `${em(E.warn, "")} PAYMENT SESSION EXPIRED. BUY CREDIT DOBARA TRY KARO.`, { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any });
          return;
        }

        const selectedPending: PendingCreditPayment = { ...pending, method: data === "paymethod_upi" ? "upi" : "usdt" };
        await db
          .update(botUsersTable)
          .set({ state: "pending_credit_payment", stateData: JSON.stringify(selectedPending) })
          .where(eq(botUsersTable.id, user.id));

        if (data === "paymethod_upi") {
          await sendPhoto(chatId, paymentQrUrl(selectedPending.credits, selectedPending.price), {
          caption:
            `${em(E.buy, "")} <b>PAYMENT QR</b>\n${divider()}\n\n` +
            `${em(E.credits, "")} <b>PACKAGE:</b> ${selectedPending.credits} CREDITS\n` +
            `${em(E.money, "")} <b>AMOUNT:</b> ${selectedPending.price !== null ? `₹${selectedPending.price}` : "CUSTOM / MANUAL"}\n` +
            `${em(E.upi, "")} <b>UPI:</b> <code>${UPI_ID}</code>\n\n` +
            `${em(E.history, "")} Complete the payment and send the screenshot in this bot for manual approval.`,
          parse_mode: "HTML",
          reply_markup: cancelKeyboard() as any,
          });
        } else {
          await send(
            chatId,
            `${em(E.usdt, "")} <b>USDT PAYMENT</b>\n${divider()}\n\n` +
            `${em(E.credits, "")} <b>PACKAGE:</b> ${selectedPending.credits} CREDITS\n` +
            `${em(E.money, "")} <b>AMOUNT:</b> ${selectedPending.price !== null ? `₹${selectedPending.price}` : "CUSTOM / MANUAL"}\n\n` +
            `${em(E.binance, "")} <b>BINANCE ID</b>\n<code>${USDT_BINANCE_ID}</code>\n\n` +
            `${em(E.star, "")} <b>BSC / BNB - BEP20</b>\n<code>${USDT_BEP20_ADDRESS}</code>\n\n` +
            `${em(E.star, "")} <b>TRX / TRON - TRC20</b>\n<code>${USDT_TRC20_ADDRESS}</code>\n\n` +
            `${em(E.star, "")} <b>ETH / ETHEREUM - ERC20</b>\n<code>${USDT_ERC20_ADDRESS}</code>\n\n` +
            `${em(E.history, "")} Address copy karo, payment complete karo, phir screenshot yahi bot mein bhejo for approval.`,
            { parse_mode: "HTML", reply_markup: usdtKeyboard() as any }
          );
        }
        return;
      }

      if (data.startsWith("pay_approve_") || data.startsWith("pay_decline_")) {
        const approved = data.startsWith("pay_approve_");
        const [, , targetTelegramId, creditsText] = data.split("_");
        const credits = parseInt(creditsText, 10);
        await safeAnswer(approved ? "Approved" : "Declined");
        if (!targetTelegramId || !Number.isFinite(credits) || credits <= 0) return;

        const [targetUser] = await db.select().from(botUsersTable).where(eq(botUsersTable.telegramId, targetTelegramId));
        if (!targetUser) return;

        if (approved) {
          const newCredits = targetUser.smsCredits + credits;
          await db.update(botUsersTable).set({ smsCredits: newCredits }).where(eq(botUsersTable.id, targetUser.id));
          await send(
            Number(targetTelegramId),
            `${em(E.check, "")} <b>PAYMENT APPROVED!</b>\n\n${em(E.credits, "")} <b>${credits} CREDITS</b> ADD HO GAYE.\nTOTAL CREDITS: <b>${newCredits}</b>`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          ).catch(() => {});
        } else {
          await send(
            Number(targetTelegramId),
            `${em(E.warn, "")} <b>PAYMENT DECLINED.</b>\n\nSCREENSHOT/AMOUNT CHECK KARKE DOBARA TRY KARO.`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() as any }
          ).catch(() => {});
        }
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
