// Creates the first patron account from .env, once.
// No hardcoded credentials in source — everything comes from env.
import bcrypt from 'bcrypt';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { query, pool } from './db.js';

const name = process.env.ADMIN_NAME || 'Direction';
const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';

if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first.');
  process.exit(1);
}
if (password.length < 8) {
  console.error('ADMIN_PASSWORD must be at least 8 characters.');
  process.exit(1);
}

try {
  const hash = await bcrypt.hash(password, 12);
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount > 0) {
    // Admin exists: reset its password to ADMIN_PASSWORD and make sure it can log
    // in (confirmed, no forced change, patron role). Makes `db:seed-admin`
    // idempotent AND a reliable "reset the admin password" tool — locally and in
    // prod — instead of silently doing nothing.
    await query(
      'UPDATE users SET password_hash = $1, role = $2, email_verified = true, must_change_password = false WHERE email = $3',
      [hash, 'patron', email],
    );
    console.log(`Admin ${email} already existed — password reset from ADMIN_PASSWORD.`);
  } else {
    // Seeded admin is pre-confirmed and keeps its chosen password (no forced change).
    await query(
      'INSERT INTO users (id, name, email, password_hash, role, email_verified, must_change_password) VALUES ($1, $2, $3, $4, $5, true, false)',
      [randomUUID(), name, email, hash, 'patron'],
    );
    console.log(`Admin created: ${email} (role patron).`);
  }
} catch (err) {
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
