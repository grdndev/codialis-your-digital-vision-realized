import { Router } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db.js';
import { signToken, cookieOptions, requireAuth, COOKIE_NAME } from '../middleware/auth.js';
import { generatePassword, sendWelcomeEmail, sendResetEmail } from '../mail.js';
import { createToken, peekToken, consumeTokenRow } from '../tokens.js';

const router = Router();

const MIN_PW = 8;

// POST /api/auth/login { email, password }
router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  // Constant-ish behaviour: always compare against a hash to avoid leaking
  // whether the email exists via timing.
  const hash = user ? user.password_hash : '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinva';
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok) return res.status(401).json({ error: 'Identifiants incorrects' });
  if (!user.email_verified) return res.status(403).json({ error: 'Compte non confirmé — vérifiez votre email' });

  res.cookie(COOKIE_NAME, signToken(user), cookieOptions());
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, mustChange: !!user.must_change_password } });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/verify { token }
// Confirms the address, generates the real password, emails the credentials,
// and flags the account so the first login forces a password change.
router.post('/verify', async (req, res) => {
  const token = String(req.body?.token || '');
  const row = await peekToken(token, 'verify');
  if (!row) return res.status(400).json({ error: 'Lien invalide ou expiré' });

  const { rows } = await query('SELECT id, name, email, role, email_verified FROM users WHERE id = $1', [row.user_id]);
  const user = rows[0];
  if (!user) return res.status(400).json({ error: 'Lien invalide ou expiré' });

  // Already confirmed: consume the token and report success idempotently, but
  // don't re-issue a new password over a working one.
  if (user.email_verified) {
    await consumeTokenRow(row.id);
    return res.json({ ok: true, alreadyVerified: true });
  }

  const password = generatePassword();
  // Send credentials first; only mutate the account if the email goes out, so a
  // failed send leaves the account still confirmable via the same link.
  try {
    await sendWelcomeEmail({ name: user.name, email: user.email, password, role: user.role });
  } catch (err) {
    console.error('Brevo send failed:', err.message);
    return res.status(502).json({ error: "Échec de l'envoi de l'email — réessayez" });
  }

  const hash = await bcrypt.hash(password, 12);
  await query(
    'UPDATE users SET password_hash = $1, email_verified = true, must_change_password = true WHERE id = $2',
    [hash, user.id],
  );
  await consumeTokenRow(row.id);
  res.json({ ok: true, email: user.email });
});

// POST /api/auth/forgot { email }
// Always answers 200 so it can't be used to enumerate registered addresses.
router.post('/forgot', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    const { rows } = await query('SELECT id, name, email_verified FROM users WHERE email = $1', [email]);
    const user = rows[0];
    // Only confirmed accounts can reset; an unconfirmed one has no real password.
    if (user && user.email_verified) {
      try {
        const token = await createToken(user.id, 'reset');
        await sendResetEmail({ name: user.name, email, token });
      } catch (err) {
        console.error('Reset email failed:', err.message);
      }
    }
  }
  res.json({ ok: true });
});

function validatePassword(password) {
  if (password.length < MIN_PW) return `Mot de passe : ${MIN_PW} caractères minimum`;
  if (!/[A-ZÀ-ÖØ-Ý]/.test(password)) return 'Le mot de passe doit contenir au moins une lettre majuscule';
  if (!/[^a-zA-Z0-9À-ÖØ-öø-ÿ\s]/.test(password)) return 'Le mot de passe doit contenir au moins un caractère spécial';
  return null;
}

// POST /api/auth/reset { token, password }
router.post('/reset', async (req, res) => {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const row = await peekToken(token, 'reset');
  if (!row) return res.status(400).json({ error: 'Lien invalide ou expiré' });

  const hash = await bcrypt.hash(password, 12);
  await query(
    'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
    [hash, row.user_id],
  );
  await consumeTokenRow(row.id);
  res.json({ ok: true });
});

// POST /api/auth/change-password { currentPassword, newPassword }
// Used both for the forced first-login change and for voluntary changes.
router.post('/change-password', requireAuth, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  const pwErr = validatePassword(newPassword);
  if (pwErr) return res.status(400).json({ error: pwErr });
  if (newPassword === currentPassword) return res.status(400).json({ error: 'Le nouveau mot de passe doit être différent' });

  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Session invalide' });

  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

  const hash = await bcrypt.hash(newPassword, 12);
  await query('UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2', [hash, user.id]);

  // Refresh the cookie so the JWT no longer carries mustChange.
  const fresh = { ...user, password_hash: hash, must_change_password: false };
  res.cookie(COOKIE_NAME, signToken(fresh), cookieOptions());
  res.json({ ok: true });
});

export default router;
