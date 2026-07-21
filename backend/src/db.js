import mysql from 'mysql2/promise';
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// TINYINT(1) <-> JS boolean, so BOOLEAN columns keep behaving like they did
// under Postgres (true/false, not 1/0) everywhere in the app and in JSON output.
function typeCast(field, next) {
  if (field.type === 'TINY' && field.length === 1) {
    const v = field.string();
    return v === null ? null : v === '1';
  }
  return next();
}

// mysql2 accepts a URL string, but we also need multipleStatements (to apply the
// whole schema.sql in one go) and the boolean typeCast — hence the object form.
function poolConfig() {
  const u = new URL(process.env.DATABASE_URL);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    multipleStatements: true,
    // Report *matched* rows (not just changed) for UPDATE, matching Postgres'
    // rowCount semantics the routes rely on for their 404 checks.
    flags: ['FOUND_ROWS'],
    typeCast,
  };
}

export const pool = mysql.createPool(poolConfig());

// --- Postgres -> MySQL compatibility shim -------------------------------------
// Call sites stay written in Postgres style. This layer:
//   * rewrites the few Postgres-only bits of SQL still used across the codebase
//   * turns $1,$2 placeholders into ? (params reordered/duplicated to match)
//   * normalises the mysql2 result to pg's { rows, rowCount } shape
// Dialect-specific queries that can't be regex-translated (RETURNING, ON
// CONFLICT, interval math, JSON functions) were rewritten inline at each site.

function translate(text) {
  return text
    // to_char(col,'YYYY-MM-DD') -> DATE_FORMAT(col,'%Y-%m-%d') (only format used)
    .replace(/to_char\(\s*([^,]+?)\s*,\s*'YYYY-MM-DD'\s*\)/gi, "DATE_FORMAT($1, '%Y-%m-%d')")
    // x::float -> CAST(x AS DOUBLE) so numeric columns come back as JS numbers
    .replace(/(\w+)::float/gi, 'CAST($1 AS DOUBLE)')
    // Remaining Postgres casts are no-ops in MySQL: ::int/::bigint (COUNT() etc
    // already return numbers), ::uuid (CHAR(36) compares fine as text), etc.
    .replace(/::(?:int|bigint|uuid|text|boolean|numeric|date|timestamptz|timestamp)/gi, '')
    // case-insensitive matching is the default collation behaviour in MySQL
    .replace(/\bILIKE\b/gi, 'LIKE');
}

function toPlaceholders(text, params = []) {
  const out = [];
  const sql = text.replace(/\$(\d+)/g, (_, n) => { out.push(params[Number(n) - 1]); return '?'; });
  return { sql, params: out };
}

async function run(text, params) {
  const { sql, params: p } = toPlaceholders(translate(text), params ?? []);
  const [result] = await pool.query(sql, p);
  // SELECT -> array of rows; INSERT/UPDATE/DELETE -> a ResultSetHeader.
  if (Array.isArray(result)) return { rows: result, rowCount: result.length };
  return { rows: [], rowCount: result.affectedRows ?? 0, insertId: result.insertId };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaSql = readFileSync(join(__dirname, '..', 'db', 'schema.sql'), 'utf8');

let dbReadyPromise = null;
async function ensureDbReady() {
  if (dbReadyPromise) return dbReadyPromise;
  dbReadyPromise = (async () => {
    // Apply the full schema first (idempotent: CREATE TABLE IF NOT EXISTS, and
    // indexes declared inline). multipleStatements (set on the pool) lets the
    // whole file run in one call.
    await pool.query(schemaSql);
    // Seed defaults that aren't part of the schema.
    await pool.query(
      "INSERT IGNORE INTO page_views (page, count) VALUES ('portfolio', 142), ('blog', 318)",
    );
    await pool.query(
      'UPDATE content SET views = FLOOR(RAND() * 50 + 10) WHERE views IS NULL OR views = 0',
    );
  })();
  dbReadyPromise.catch((err) => {
    console.error('ensureDbReady error:', err.message);
    dbReadyPromise = null; // allow retry on next query instead of caching failure
  });
  return dbReadyPromise;
}

export async function query(text, params) {
  await ensureDbReady();
  return run(text, params);
}
