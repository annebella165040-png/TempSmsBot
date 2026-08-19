import crypto from "crypto";

type MiniAppLicensePayload = {
  tid: string;
  exp: number;
};

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="), "base64");
}

function licenseSecret(): string {
  return (
    process.env.MINI_APP_LICENSE_SECRET ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.ADMIN_PASSWORD ||
    "annebella-mini-app-license"
  );
}

function sign(payload: string): string {
  return base64Url(crypto.createHmac("sha256", licenseSecret()).update(payload).digest());
}

export function createMiniAppLicense(telegramId: string, expiresAt: Date): string {
  const payload = base64Url(JSON.stringify({ tid: telegramId, exp: expiresAt.getTime() }));
  return `${payload}.${sign(payload)}`;
}

export function verifyMiniAppLicense(
  license: string,
  telegramId: string,
): { ok: true; expiresAt: Date } | { ok: false; error: string } {
  const [payloadPart, signature] = license.split(".");
  if (!payloadPart || !signature) return { ok: false, error: "License missing" };
  const expected = sign(payloadPart);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: "License is invalid" };
  }

  let payload: MiniAppLicensePayload;
  try {
    payload = JSON.parse(decodeBase64Url(payloadPart).toString("utf8")) as MiniAppLicensePayload;
  } catch {
    return { ok: false, error: "License payload is invalid" };
  }

  if (payload.tid !== telegramId) return { ok: false, error: "License user mismatch" };
  if (!Number.isFinite(payload.exp) || payload.exp <= Date.now()) {
    return { ok: false, error: "License expired" };
  }
  return { ok: true, expiresAt: new Date(payload.exp) };
}
