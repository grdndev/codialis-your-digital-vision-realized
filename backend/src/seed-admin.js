// Creates the first patron account from .env, once.
// No hardcoded credentials in source — everything comes from env.
import bcrypt from 'bcrypt';
import 'dotenv/config';
import { pool } from './db.js';

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
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount > 0) {
    console.log(`Admin ${email} already exists — nothing to do.`);
  } else {
    const hash = await bcrypt.hash(password, 12);
    // Seeded admin is pre-confirmed and keeps its chosen password (no forced change).
    await pool.query(
      'INSERT INTO users (name, email, password_hash, role, email_verified, must_change_password) VALUES ($1, $2, $3, $4, true, false)',
      [name, email, hash, 'patron'],
    );
    console.log(`Admin created: ${email} (role patron).`);
  }
} catch (err) {
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
