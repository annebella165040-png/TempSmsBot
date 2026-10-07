import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Railway uses DATABASE_URL. Replit demos can safely use the separately
// stored NEON_DATABASE_URL secret without replacing Replit's managed key.
export const databaseUrl =
  process.env.DATABASE_URL?.trim() || process.env.NEON_DATABASE_URL?.trim();
export const databaseConfigured = Boolean(databaseUrl);

// Keep the HTTP process alive when the database variable is temporarily
// missing so platform healthchecks can still report the real service status.
// Database-backed routes will fail clearly until DATABASE_URL is configured.
export const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 })
  : new Pool({ connectionTimeoutMillis: 5000 });

const requiredRuntimeTables = [
  "firebase_panels",
  "bot_users",
  "gift_cards",
  "referrals",
  "sms_log_entries",
  "app_settings",
  "app_tasks",
];

const requiredRuntimeColumns: Record<string, string[]> = {
  firebase_panels: ["id", "name", "firebase_url", "secret_key", "created_at"],
  bot_users: [
    "id",
    "telegram_id",
    "username",
    "first_name",
    "referral_code",
    "referred_by",
    "referral_count",
    "sms_credits",
    "get_number_expires_at",
    "send_sms_unlocked",
    "web_panel_expires_at",
    "is_banned",
    "state",
    "state_data",
    "assigned_device_id",
    "assigned_panel_id",
    "created_at",
    "updated_at",
  ],
  gift_cards: ["id", "code", "type", "value", "used_by", "used_at", "created_at"],
  referrals: ["id", "referrer_id", "referred_telegram_id", "created_at"],
  sms_log_entries: ["id", "sms_key", "panel_id", "device_id", "sender", "message_text", "message_time", "sent_at", "attempts", "created_at"],
  app_settings: ["key", "value", "updated_at"],
  app_tasks: ["id", "title", "description", "url", "reward_credits", "task_type", "is_active", "created_at"],
};

let runtimeSchemaSetup: Promise<void> | null = null;
const rawPoolQuery = pool.query.bind(pool) as (...args: any[]) => Promise<any>;

function isRecoverableSchemaError(err: unknown): boolean {
  const maybe = err as { code?: string; message?: string };
  return (
    maybe.code === "42P01" ||
    maybe.code === "42703" ||
    String(maybe.message || "").includes("does not exist")
  );
}

async function runRuntimeSchemaSetup(): Promise<void> {
  if (!databaseConfigured) return;

  await rawPoolQuery("CREATE SCHEMA IF NOT EXISTS public");
  await rawPoolQuery("SET search_path TO public");

  await rawPoolQuery(`
    CREATE TABLE IF NOT EXISTS public.firebase_panels (
      id serial PRIMARY KEY,
      name text NOT NULL,
      firebase_url text NOT NULL,
      secret_key text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await rawPoolQuery(`
    CREATE TABLE IF NOT EXISTS public.bot_users (
      id serial PRIMARY KEY,
      telegram_id text NOT NULL,
      username text,
      first_name text NOT NULL,
      referral_code text NOT NULL,
      referred_by text,
      referral_count integer NOT NULL DEFAULT 0,
      sms_credits integer NOT NULL DEFAULT 0,
      get_number_expires_at timestamptz,
      send_sms_unlocked boolean NOT NULL DEFAULT false,
      web_panel_expires_at timestamptz,
      is_banned boolean NOT NULL DEFAULT false,
      state text NOT NULL DEFAULT 'main_menu',
      state_data text,
      assigned_device_id text,
      assigned_panel_id integer,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await rawPoolQuery(`
    CREATE TABLE IF NOT EXISTS public.gift_cards (
      id serial PRIMARY KEY,
      code text NOT NULL,
      type text NOT NULL,
      value text NOT NULL,
      used_by text,
      used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await rawPoolQuery(`
    CREATE TABLE IF NOT EXISTS public.referrals (
      id serial PRIMARY KEY,
      referrer_id integer NOT NULL,
      referred_telegram_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await rawPoolQuery(`
    CREATE TABLE IF NOT EXISTS public.sms_log_entries (
      id serial PRIMARY KEY,
      sms_key text NOT NULL,
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

  await rawPoolQuery(`
    CREATE TABLE IF NOT EXISTS public.app_settings (
      key text PRIMARY KEY,
      value text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await rawPoolQuery(`
    CREATE TABLE IF NOT EXISTS public.app_tasks (
      id serial PRIMARY KEY,
      title text NOT NULL,
      description text,
      url text NOT NULL,
      reward_credits integer NOT NULL DEFAULT 0,
      task_type text NOT NULL DEFAULT 'channel',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await rawPoolQuery("ALTER TABLE public.firebase_panels ADD COLUMN IF NOT EXISTS secret_key text NOT NULL DEFAULT ''");
  await rawPoolQuery("ALTER TABLE public.firebase_panels ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()");
  await rawPoolQuery("ALTER TABLE public.bot_users ADD COLUMN IF NOT EXISTS send_sms_unlocked boolean NOT NULL DEFAULT false");
  await rawPoolQuery("ALTER TABLE public.bot_users ADD COLUMN IF NOT EXISTS web_panel_expires_at timestamptz");
  await rawPoolQuery("ALTER TABLE public.bot_users ADD COLUMN IF NOT EXISTS get_number_expires_at timestamptz");
  await rawPoolQuery("ALTER TABLE public.bot_users ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false");
  await rawPoolQuery("ALTER TABLE public.bot_users ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'main_menu'");
  await rawPoolQuery("ALTER TABLE public.bot_users ADD COLUMN IF NOT EXISTS state_data text");
  await rawPoolQuery("ALTER TABLE public.bot_users ADD COLUMN IF NOT EXISTS assigned_device_id text");
  await rawPoolQuery("ALTER TABLE public.bot_users ADD COLUMN IF NOT EXISTS assigned_panel_id integer");
  await rawPoolQuery("ALTER TABLE public.sms_log_entries ADD COLUMN IF NOT EXISTS sent_at timestamptz");
  await rawPoolQuery("ALTER TABLE public.sms_log_entries ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0");
  await rawPoolQuery("ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS key text");
  await rawPoolQuery("ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS value text NOT NULL DEFAULT ''");
  await rawPoolQuery("ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()");
  await rawPoolQuery(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'app_settings'
          AND column_name = 'setting_key'
      ) THEN
        EXECUTE 'UPDATE public.app_settings SET key = setting_key WHERE key IS NULL';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'app_settings'
          AND column_name = 'setting_value'
      ) THEN
        EXECUTE 'UPDATE public.app_settings SET value = setting_value WHERE value = ''''';
      END IF;
    END $$;
  `);

  await rawPoolQuery("CREATE UNIQUE INDEX IF NOT EXISTS bot_users_telegram_id_unique_idx ON public.bot_users (telegram_id)");
  await rawPoolQuery("CREATE UNIQUE INDEX IF NOT EXISTS bot_users_referral_code_unique_idx ON public.bot_users (referral_code)");
  await rawPoolQuery("CREATE UNIQUE INDEX IF NOT EXISTS gift_cards_code_unique_idx ON public.gift_cards (code)");
  await rawPoolQuery("CREATE UNIQUE INDEX IF NOT EXISTS sms_log_entries_sms_key_unique_idx ON public.sms_log_entries (sms_key)");
  await rawPoolQuery("CREATE UNIQUE INDEX IF NOT EXISTS app_settings_key_unique_idx ON public.app_settings (key)");

  const result = await rawPoolQuery(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1)
    `,
    [requiredRuntimeTables],
  ) as { rows: Array<{ table_name: string }> };
  const existing = new Set(result.rows.map((row) => row.table_name));
  const missing = requiredRuntimeTables.filter((table) => !existing.has(table));
  if (missing.length) {
    throw new Error(`Runtime database setup incomplete. Missing tables: ${missing.join(", ")}`);
  }

  const columnResult = await rawPoolQuery(
    `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1)
    `,
    [requiredRuntimeTables],
  ) as { rows: Array<{ table_name: string; column_name: string }> };
  const columnMap = new Map<string, Set<string>>();
  for (const row of columnResult.rows) {
    if (!columnMap.has(row.table_name)) columnMap.set(row.table_name, new Set());
    columnMap.get(row.table_name)?.add(row.column_name);
  }
  const missingColumns = Object.entries(requiredRuntimeColumns)
    .flatMap(([table, columns]) => columns.filter((column) => !columnMap.get(table)?.has(column)).map((column) => `${table}.${column}`));
  if (missingColumns.length) {
    throw new Error(`Runtime database setup incomplete. Missing columns: ${missingColumns.join(", ")}`);
  }
}

async function ensureRuntimeSchema(): Promise<void> {
  if (!runtimeSchemaSetup) {
    runtimeSchemaSetup = runRuntimeSchemaSetup().catch((err) => {
      runtimeSchemaSetup = null;
      throw err;
    });
  }
  await runtimeSchemaSetup;
}

(pool as any).query = async (...args: any[]) => {
  try {
    return await rawPoolQuery(...args);
  } catch (err) {
    if (!isRecoverableSchemaError(err)) throw err;
    await ensureRuntimeSchema();
    return rawPoolQuery(...args);
  }
};

void ensureRuntimeSchema().catch(() => undefined);

export const db = drizzle(pool, { schema });

export * from "./schema";
