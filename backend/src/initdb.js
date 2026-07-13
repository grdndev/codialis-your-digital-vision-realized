// Applies db/schema.sql. Idempotent (CREATE TABLE IF NOT EXISTS).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const sql = readFileSync(join(__dirname, '..', 'db', 'schema.sql'), 'utf8');

try {
  await pool.query(sql);
  console.log('Schema applied.');
} catch (err) {
  console.error('Schema failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
