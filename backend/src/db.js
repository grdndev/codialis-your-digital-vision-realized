import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

let dbReadyPromise = null;
async function ensureDbReady() {
  if (dbReadyPromise) return dbReadyPromise;
  dbReadyPromise = (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS page_views (
          page TEXT PRIMARY KEY,
          count BIGINT NOT NULL DEFAULT 0
        );
      `);
      await pool.query(`
        ALTER TABLE content ADD COLUMN IF NOT EXISTS views BIGINT NOT NULL DEFAULT 0;
      `);
      await pool.query(`
        INSERT INTO page_views (page, count) VALUES ('portfolio', 142), ('blog', 318)
        ON CONFLICT (page) DO NOTHING;
      `);
      await pool.query(`
        UPDATE content SET views = floor(random() * 50 + 10)::bigint WHERE views IS NULL OR views = 0;
      `);
    } catch (err) {
      console.error('ensureDbReady error:', err.message);
    }
  })();
  return dbReadyPromise;
}

export async function query(text, params) {
  await ensureDbReady();
  return pool.query(text, params);
}
