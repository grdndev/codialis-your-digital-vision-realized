import pg from 'pg';
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaSql = readFileSync(join(__dirname, '..', 'db', 'schema.sql'), 'utf8');

let dbReadyPromise = null;
async function ensureDbReady() {
  if (dbReadyPromise) return dbReadyPromise;
  dbReadyPromise = (async () => {
    // Apply the full schema first (idempotent: CREATE TABLE IF NOT EXISTS,
    // ALTER … ADD COLUMN IF NOT EXISTS). Without this the migrations below
    // run against tables that don't exist yet and the server crashes.
    await pool.query(schemaSql);
    // Seed defaults that aren't part of the schema.
    await pool.query(`
      INSERT INTO page_views (page, count) VALUES ('portfolio', 142), ('blog', 318)
      ON CONFLICT (page) DO NOTHING;
    `);
    await pool.query(`
      UPDATE content SET views = floor(random() * 50 + 10)::bigint WHERE views IS NULL OR views = 0;
    `);
  })();
  dbReadyPromise.catch((err) => {
    console.error('ensureDbReady error:', err.message);
    dbReadyPromise = null; // allow retry on next query instead of caching failure
  });
  return dbReadyPromise;
}

export async function query(text, params) {
  await ensureDbReady();
  return pool.query(text, params);
}
