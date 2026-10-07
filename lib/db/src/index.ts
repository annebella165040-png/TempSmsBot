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

let runtimeSchemaSetup: Promise<void> | null = null;
const rawPoolQuery = pool.query.bind(pool) as (...args: any[]) => Promise<any>;

function isUndefinedTableError(err: unknown): boolean {
  const maybe = err as { code?: string; message?: string };
  return maybe.code === "42P01" || String(maybe.message || "").includes("does not exist");
}

async function runRuntimeSchemaSetup(): Promise<void> {
  if (!databaseConfigured) return;

  await rawPoolQuery(`
    CREATE TABLE IF NOT EXISTS firebase_panels (
      id serial PRIMARY KEY,
      name text NOT NULL,
      firebase_url text NOT NULL,
      secret_key text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await rawPoolQuery(`
    CREATE TABLE IF NOT EXISTS bot_users (
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
    CREATE TABLE IF NOT EXISTS gift_cards (
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
    CREATE TABLE IF NOT EXISTS referrals (
      id serial PRIMARY KEY,
      referrer_id integer NOT NULL,
      referred_telegram_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await rawPoolQuery(`
    CREATE TABLE IF NOT EXISTS sms_log_entries (
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
    CREATE TABLE IF NOT EXISTS app_settings (
      key text PRIMARY KEY,
      value text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await rawPoolQuery(`
    CREATE TABLE IF NOT EXISTS app_tasks (
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

  await rawPoolQuery("ALTER TABLE firebase_panels ADD COLUMN IF NOT EXISTS secret_key text NOT NULL DEFAULT ''");
  await rawPoolQuery("ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS send_sms_unlocked boolean NOT NULL DEFAULT false");
  await rawPoolQuery("ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS web_panel_expires_at timestamptz");
  await rawPoolQuery("ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS get_number_expires_at timestamptz");
  await rawPoolQuery("ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false");
  await rawPoolQuery("ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'main_menu'");
  await rawPoolQuery("ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS state_data text");
  await rawPoolQuery("ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS assigned_device_id text");
  await rawPoolQuery("ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS assigned_panel_id integer");
  await rawPoolQuery("ALTER TABLE sms_log_entries ADD COLUMN IF NOT EXISTS sent_at timestamptz");
  await rawPoolQuery("ALTER TABLE sms_log_entries ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0");

  await rawPoolQuery("CREATE UNIQUE INDEX IF NOT EXISTS bot_users_telegram_id_unique_idx ON bot_users (telegram_id)");
  await rawPoolQuery("CREATE UNIQUE INDEX IF NOT EXISTS bot_users_referral_code_unique_idx ON bot_users (referral_code)");
  await rawPoolQuery("CREATE UNIQUE INDEX IF NOT EXISTS gift_cards_code_unique_idx ON gift_cards (code)");
  await rawPoolQuery("CREATE UNIQUE INDEX IF NOT EXISTS sms_log_entries_sms_key_unique_idx ON sms_log_entries (sms_key)");

  const result = await rawPoolQuery(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = ANY($1)
    `,
    [requiredRuntimeTables],
  ) as { rows: Array<{ table_name: string }> };
  const existing = new Set(result.rows.map((row) => row.table_name));
  const missing = requiredRuntimeTables.filter((table) => !existing.has(table));
  if (missing.length) {
    throw new Error(`Runtime database setup incomplete. Missing tables: ${missing.join(", ")}`);
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
    if (!isUndefinedTableError(err)) throw err;
    await ensureRuntimeSchema();
    return rawPoolQuery(...args);
  }
};

void ensureRuntimeSchema().catch(() => undefined);

export const db = drizzle(pool, { schema });

export * from "./schema";
