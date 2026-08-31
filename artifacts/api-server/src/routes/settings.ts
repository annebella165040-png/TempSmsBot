import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

type PaymentSettings = {
  upiId: string;
  usdtBinanceId: string;
  usdtBep20Address: string;
  usdtTrc20Address: string;
  usdtErc20Address: string;
};

const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  upiId: "gauravpayout@fam",
  usdtBinanceId: "1114491025",
  usdtBep20Address: "0x430b7abc929366ba7c4e3ca26b6c4177590c0c4f",
  usdtTrc20Address: "TDfzW7sn7Hut3uQr6Gnk6TyVN2aG6UoUEn",
  usdtErc20Address: "0x430b7abc929366ba7c4e3ca26b6c4177590c0c4f",
};

let ready = false;

async function ensurePaymentSettingsStorage(): Promise<void> {
  if (ready) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key text PRIMARY KEY,
      value text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  ready = true;
}

function settingKey(key: keyof PaymentSettings): string {
  return `payment.${key}`;
}

async function getPaymentSettings(): Promise<PaymentSettings> {
  await ensurePaymentSettingsStorage();
  const result = await pool.query<{ key: string; value: string }>(
    "SELECT key, value FROM app_settings WHERE key LIKE 'payment.%'",
  );
  const settings: PaymentSettings = { ...DEFAULT_PAYMENT_SETTINGS };
  for (const row of result.rows) {
    const key = row.key.replace(/^payment\./, "") as keyof PaymentSettings;
    if (key in settings) settings[key] = row.value;
  }
  return settings;
}

async function updatePaymentSettings(input: Partial<PaymentSettings>): Promise<PaymentSettings> {
  await ensurePaymentSettingsStorage();
  const allowed = Object.keys(DEFAULT_PAYMENT_SETTINGS) as Array<keyof PaymentSettings>;
  for (const key of allowed) {
    if (!(key in input)) continue;
    const value = String(input[key] ?? "").trim();
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [settingKey(key), value],
    );
  }
  return getPaymentSettings();
}

router.get("/settings/payment", async (_req, res): Promise<void> => {
  res.json(await getPaymentSettings());
});

router.patch("/settings/payment", async (req, res): Promise<void> => {
  const settings = await updatePaymentSettings({
    upiId: typeof req.body?.upiId === "string" ? req.body.upiId : undefined,
    usdtBinanceId: typeof req.body?.usdtBinanceId === "string" ? req.body.usdtBinanceId : undefined,
    usdtBep20Address: typeof req.body?.usdtBep20Address === "string" ? req.body.usdtBep20Address : undefined,
    usdtTrc20Address: typeof req.body?.usdtTrc20Address === "string" ? req.body.usdtTrc20Address : undefined,
    usdtErc20Address: typeof req.body?.usdtErc20Address === "string" ? req.body.usdtErc20Address : undefined,
  });
  res.json(settings);
});

export default router;
