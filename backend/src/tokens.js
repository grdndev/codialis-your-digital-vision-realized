// Single-use, expiring tokens for account verification and password reset.
// The raw token travels only in the emailed link; the DB stores its SHA-256
// hash, so a database leak can't be replayed against the endpoints.
import { randomBytes, createHash } from 'node:crypto';
import { query } from './db.js';

// Lifetimes (minutes). Verification is generous; reset is short-lived.
const TTL_MINUTES = { verify: 48 * 60, reset: 60 };

function hashToken(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

// Creates a fresh token for (userId, kind), invalidating any prior unused ones
// of the same kind so only the latest link works. Returns the raw token.
export async function createToken(userId, kind) {
  const ttl = TTL_MINUTES[kind];
  if (!ttl) throw new Error(`Unknown token kind: ${kind}`);
  await query(
    "UPDATE user_tokens SET used_at = now() WHERE user_id = $1 AND kind = $2 AND used_at IS NULL",
    [userId, kind],
  );
  const raw = randomBytes(32).toString('hex');
  await query(
    `INSERT INTO user_tokens (user_id, kind, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + ($4 || ' minutes')::interval)`,
    [userId, kind, hashToken(raw), String(ttl)],
  );
  return raw;
}

// Validates a raw token without consuming it. Returns { id (token row id),
// user_id } when valid & unexpired & unused, else null.
export async function peekToken(raw, kind) {
  if (!raw || typeof raw !== 'string') return null;
  const { rows } = await query(
    `SELECT id, user_id FROM user_tokens
     WHERE token_hash = $1 AND kind = $2 AND used_at IS NULL AND expires_at > now()
     LIMIT 1`,
    [hashToken(raw), kind],
  );
  return rows[0] || null;
}

// Marks a token row as used (single-use enforcement).
export async function consumeTokenRow(tokenRowId) {
  await query('UPDATE user_tokens SET used_at = now() WHERE id = $1', [tokenRowId]);
}
