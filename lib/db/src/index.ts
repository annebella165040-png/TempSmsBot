import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Prefer the explicit Neon URL when it is present. This prevents Railway from
// silently continuing to use an old exhausted DATABASE_URL after a fresh Neon
// database is added as NEON_DATABASE_URL.
export const databaseUrl =
  process.env.NEON_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
export const databaseConfigured = Boolean(databaseUrl);
const poolMax = Number(process.env.PG_POOL_MAX || 2);
const idleTimeoutMillis = Number(process.env.PG_IDLE_TIMEOUT_MS || 10000);

function safeDatabaseTarget(value: string | undefined): string {
  if (!value) return "not configured";
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return "configured";
  }
}

export const databaseSource = process.env.NEON_DATABASE_URL?.trim()
  ? "NEON_DATABASE_URL"
  : process.env.DATABASE_URL?.trim()
    ? "DATABASE_URL"
    : "none";
export const databaseTarget = safeDatabaseTarget(databaseUrl);

// Keep the HTTP process alive when the database variable is temporarily
// missing so platform healthchecks can still report the real service status.
// Database-backed routes will fail clearly until DATABASE_URL is configured.
export const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis,
      max: Number.isFinite(poolMax) && poolMax > 0 ? Math.floor(poolMax) : 2,
    })
  : new Pool({ connectionTimeoutMillis: 5000, idleTimeoutMillis, max: 1 });
export const db = drizzle(pool, { schema });

export * from "./schema";
