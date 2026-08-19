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
export const db = drizzle(pool, { schema });

export * from "./schema";
