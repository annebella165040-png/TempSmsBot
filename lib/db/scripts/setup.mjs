import pg from "pg";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.NEON_DATABASE_URL?.trim();
const requiredTables = [
  "firebase_panels",
  "bot_users",
  "gift_cards",
  "referrals",
  "sms_log_entries",
  "app_settings",
  "app_tasks",
];

if (!databaseUrl) {
  console.error("DATABASE_URL or NEON_DATABASE_URL is required for database setup");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 10000,
  max: 1,
});

async function query(sql, params) {
  await pool.query(sql, params);
}

async function status() {
  const result = await pool.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = ANY($1)
      ORDER BY table_name
    `,
    [requiredTables],
  );
  const tables = result.rows.map((row) => row.table_name);
  const existing = new Set(tables);
  const missing = requiredTables.filter((table) => !existing.has(table));
  return { tables, missing };
}

try {
  const meta = await pool.query("SELECT current_database() AS database, current_schema() AS schema");
  console.log("Database setup target", meta.rows[0]);

  await query(`
    CREATE TABLE IF NOT EXISTS firebase_panels (
      id serial PRIMARY KEY,
      name text NOT NULL,
      firebase_url text NOT NULL,
      secret_key text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await query(`
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

  await query(`
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

  await query(`
    CREATE TABLE IF NOT EXISTS referrals (
      id serial PRIMARY KEY,
      referrer_id integer NOT NULL,
      referred_telegram_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await query(`
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

  await query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key text PRIMARY KEY,
      value text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await query(`
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

  await query("ALTER TABLE firebase_panels ADD COLUMN IF NOT EXISTS secret_key text NOT NULL DEFAULT ''");
  await query("ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS send_sms_unlocked boolean NOT NULL DEFAULT false");
  await query("ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS web_panel_expires_at timestamptz");
  await query("ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS get_number_expires_at timestamptz");
  await query("ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false");
  await query("ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'main_menu'");
  await query("ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS state_data text");
  await query("ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS assigned_device_id text");
  await query("ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS assigned_panel_id integer");
  await query("ALTER TABLE sms_log_entries ADD COLUMN IF NOT EXISTS sent_at timestamptz");
  await query("ALTER TABLE sms_log_entries ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0");

  await query("CREATE UNIQUE INDEX IF NOT EXISTS bot_users_telegram_id_unique_idx ON bot_users (telegram_id)");
  await query("CREATE UNIQUE INDEX IF NOT EXISTS bot_users_referral_code_unique_idx ON bot_users (referral_code)");
  await query("CREATE UNIQUE INDEX IF NOT EXISTS gift_cards_code_unique_idx ON gift_cards (code)");
  await query("CREATE UNIQUE INDEX IF NOT EXISTS sms_log_entries_sms_key_unique_idx ON sms_log_entries (sms_key)");

  const result = await status();
  if (result.missing.length) {
    throw new Error(`Database setup incomplete. Missing tables: ${result.missing.join(", ")}`);
  }

  console.log("Database setup complete", { tables: result.tables });
} catch (err) {
  console.error("Database setup failed", err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
} finally {
  await pool.end();
}
