import { Router } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db.js';
import { randomBytes } from 'node:crypto';
import { requireAuth, requirePatron } from '../middleware/auth.js';
import { sendVerifyEmail } from '../mail.js';
import { createToken } from '../tokens.js';

const router = Router();

// GET /api/accounts/featured — PUBLIC (consumed by the public site's team
// section). Only members flagged « à la une » are returned, and only their
// display fields — never the email. Patron first, then alphabetical.
router.get('/featured', async (req, res) => {
  const { rows } = await query(
    "SELECT id, name, poste, photo FROM users WHERE featured IS TRUE ORDER BY role DESC, name ASC",
  );
  res.json(rows.map((r) => ({ id: r.id, name: r.name, role: r.poste, image: r.photo })));
});

// Everything below requires authentication.
router.use(requireAuth);

// GET /api/accounts — any authenticated user (no hashes exposed)
router.get('/', async (req, res) => {
  const { rows } = await query(
    'SELECT id, name, prenom, nom, email, role, poste, email_verified, photo, featured FROM users ORDER BY role DESC, name ASC',
  );
  res.json(rows);
});

// POST /api/accounts — patron creates a user.
// No password is issued yet: the account starts unverified with an unusable
// placeholder hash, and a confirmation link is emailed. The real password is
// generated and sent only after the owner confirms the address (see
// POST /api/auth/verify). This proves the address before any credential leaves.
router.post('/', requirePatron, async (req, res) => {
  const prenom = String(req.body?.prenom || '').trim();
  const nom = String(req.body?.nom || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const poste = String(req.body?.poste || '').trim();
  const role = req.body?.role === 'patron' ? 'patron' : 'employe';
  // `name` stays as the display/JWT identity — kept in sync with prenom + nom.
  const name = `${prenom} ${nom}`.trim();

  if (!prenom || !nom || !email) return res.status(400).json({ error: 'Prénom, nom et email requis' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Email invalide' });

  const dup = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (dup.rowCount > 0) return res.status(409).json({ error: 'Cet email existe déjà' });

  // Unusable placeholder hash: login can never match it until a real password
  // is set at verification time.
  const photo = typeof req.body?.photo === 'string' ? req.body.photo : '';
  const featured = req.body?.featured === true;
  const placeholder = await bcrypt.hash(randomBytes(24).toString('hex'), 12);
  const { rows } = await query(
    `INSERT INTO users (name, prenom, nom, email, password_hash, role, poste, photo, featured, email_verified, must_change_password)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, false)
     RETURNING id, name, prenom, nom, email, role, poste, email_verified, photo, featured`,
    [name, prenom, nom, email, placeholder, role, poste, photo, featured],
  );
  const user = rows[0];

  // Send the confirmation link; if the email fails, roll back so we never leave
  // a dangling unverified account the owner can't act on.
  try {
    const token = await createToken(user.id, 'verify');
    await sendVerifyEmail({ name, email, role, token });
  } catch (err) {
    console.error('Brevo send failed:', err.message);
    await query('DELETE FROM users WHERE id = $1', [user.id]);
    return res.status(502).json({ error: "Échec de l'envoi de l'email — compte non créé" });
  }

  res.status(201).json({ ...user, emailed: true, pending: true });
});

// PATCH /api/accounts/:id — patron edits an account (everything but the password)
router.patch('/:id', requirePatron, async (req, res) => {
  const { id } = req.params;
  const prenom = String(req.body?.prenom || '').trim();
  const nom = String(req.body?.nom || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const poste = String(req.body?.poste || '').trim();
  const role = req.body?.role === 'patron' ? 'patron' : 'employe';
  const name = `${prenom} ${nom}`.trim();

  if (!prenom || !nom || !email) return res.status(400).json({ error: 'Prénom, nom et email requis' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Email invalide' });

  const target = await query('SELECT role FROM users WHERE id = $1', [id]);
  if (target.rowCount === 0) return res.status(404).json({ error: 'Compte introuvable' });

  // Email must stay unique (ignoring the row itself).
  const dup = await query('SELECT 1 FROM users WHERE email = $1 AND id <> $2', [email, id]);
  if (dup.rowCount > 0) return res.status(409).json({ error: 'Cet email existe déjà' });

  // Never demote the last patron out of the patron role.
  if (target.rows[0].role === 'patron' && role !== 'patron') {
    const patrons = await query("SELECT COUNT(*)::int AS n FROM users WHERE role = 'patron'");
    if (patrons.rows[0].n <= 1) return res.status(400).json({ error: 'Impossible de rétrograder le dernier patron' });
  }

  const photo = typeof req.body?.photo === 'string' ? req.body.photo : '';
  const featured = req.body?.featured === true;
  const { rows } = await query(
    'UPDATE users SET name = $1, prenom = $2, nom = $3, email = $4, poste = $5, role = $6, photo = $7, featured = $8 WHERE id = $9 RETURNING id, name, prenom, nom, email, role, poste, email_verified, photo, featured',
    [name, prenom, nom, email, poste, role, photo, featured, id],
  );
  res.json(rows[0]);
});

// DELETE /api/accounts/:id — patron; cannot delete self or the last patron
router.delete('/:id', requirePatron, async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });

  const target = await query('SELECT role FROM users WHERE id = $1', [id]);
  if (target.rowCount === 0) return res.status(404).json({ error: 'Compte introuvable' });
  if (target.rows[0].role === 'patron') {
    const patrons = await query("SELECT COUNT(*)::int AS n FROM users WHERE role = 'patron'");
    if (patrons.rows[0].n <= 1) return res.status(400).json({ error: 'Impossible de supprimer le dernier patron' });
  }

  await query('DELETE FROM users WHERE id = $1', [id]);
  res.json({ ok: true });
});

export default router;
