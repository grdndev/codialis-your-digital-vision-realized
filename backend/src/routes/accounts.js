import { Router } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db.js';
import { randomBytes, randomUUID } from 'node:crypto';
import { requireAuth, requirePatron, isManager } from '../middleware/auth.js';

// Rôles autorisés à la création/édition d'un compte.
const ROLES = ['patron', 'chef', 'employe'];
const sanitizeRole = (r) => (ROLES.includes(r) ? r : 'employe');
import { sendVerifyEmail } from '../mail.js';
import { createToken } from '../tokens.js';

const router = Router();

// Ordre d'affichage de la vitrine : direction, puis chefs de projet, puis
// employés. MySQL ne peut pas trier là-dessus sans filesort (voir plus bas), le
// classement final se fait donc en JS sur un tableau de quelques lignes.
const TEAM_RANK = { patron: 0, chef: 1, employe: 2 };

// GET /api/accounts/team — PUBLIC (consumed by the public site's team section).
// TOUTE l'équipe est publiée, direction comprise : il n'y a pas de sélection
// « à la une ». Seuls les champs d'affichage sortent — jamais l'email ni le rôle.
//
// Le ORDER BY SQL reste (role DESC, name ASC) pour coller à l'index
// users_role_name_idx : sans lui, MySQL trierait en filesort avec la colonne
// `photo` (LONGTEXT) dans le buffer -> ER_OUT_OF_SORTMEMORY. Le tri par rôle
// ci-dessous est stable, donc l'ordre alphabétique est conservé dans chaque rôle.
router.get('/team', async (req, res) => {
  const { rows } = await query(
    'SELECT id, name, role, poste, photo FROM users ORDER BY role DESC, name ASC',
  );
  rows.sort((a, b) => (TEAM_RANK[a.role] ?? 3) - (TEAM_RANK[b.role] ?? 3));
  res.json(rows.map((r) => ({ id: r.id, name: r.name, role: r.poste, image: r.photo })));
});

// Everything below requires authentication.
router.use(requireAuth);

// GET /api/accounts — any authenticated user (no hashes exposed).
// Les ancres de solde (congés/heures) sont visibles de la direction et du chef
// de projet (vue d'équipe) — un employé ne reçoit que les siennes (null pour
// les autres).
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, prenom, nom, email, role, poste, email_verified, photo,
            to_char(created_at, 'YYYY-MM-DD') AS "createdAt",
            leave_balance::float AS "leaveBalance",
            to_char(leave_anchor, 'YYYY-MM-DD') AS "leaveAnchor",
            hours_balance::float AS "hoursBalance",
            to_char(hours_anchor, 'YYYY-MM-DD') AS "hoursAnchor"
     FROM users ORDER BY role DESC, name ASC`,
  );
  const canSeeAll = isManager(req.user);
  res.json(rows.map((r) => (canSeeAll || r.id === req.user.id
    ? r
    : { ...r, leaveBalance: null, leaveAnchor: null, hoursBalance: null, hoursAnchor: null })));
});

// PATCH /api/accounts/:id/balances — patron saisit/corrige un solde (congés en
// jours et/ou heures). La valeur saisie est le solde RÉEL du moment : l'ancre
// passe à aujourd'hui, le calcul repart de là (aucun double comptage).
router.patch('/:id/balances', requirePatron, async (req, res) => {
  const { id } = req.params;
  const sets = [];
  const params = [];
  for (const [field, col] of [['leave', 'leave'], ['hours', 'hours']]) {
    if (req.body?.[field] === undefined) continue;
    const v = Number.parseFloat(req.body[field]);
    if (!Number.isFinite(v) || v < -999 || v > 9999) return res.status(400).json({ error: 'Solde invalide' });
    params.push(v);
    sets.push(`${col}_balance = $${params.length}, ${col}_anchor = CURRENT_DATE`);
  }
  if (sets.length === 0) return res.status(400).json({ error: 'Aucun solde fourni' });
  params.push(id);
  const { rowCount } = await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  if (rowCount === 0) return res.status(404).json({ error: 'Compte introuvable' });
  const { rows } = await query(
    `SELECT id,
            leave_balance::float AS "leaveBalance",
            to_char(leave_anchor, 'YYYY-MM-DD') AS "leaveAnchor",
            hours_balance::float AS "hoursBalance",
            to_char(hours_anchor, 'YYYY-MM-DD') AS "hoursAnchor"
     FROM users WHERE id = $1`,
    [id],
  );
  res.json(rows[0]);
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
  const role = sanitizeRole(req.body?.role);
  // `name` stays as the display/JWT identity — kept in sync with prenom + nom.
  const name = `${prenom} ${nom}`.trim();

  if (!prenom || !nom || !email) return res.status(400).json({ error: 'Prénom, nom et email requis' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Email invalide' });

  const dup = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (dup.rowCount > 0) return res.status(409).json({ error: 'Cet email existe déjà' });

  // Unusable placeholder hash: login can never match it until a real password
  // is set at verification time.
  const photo = typeof req.body?.photo === 'string' ? req.body.photo : '';
  const placeholder = await bcrypt.hash(randomBytes(24).toString('hex'), 12);
  const id = randomUUID();
  await query(
    `INSERT INTO users (id, name, prenom, nom, email, password_hash, role, poste, photo, email_verified, must_change_password)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, false)`,
    [id, name, prenom, nom, email, placeholder, role, poste, photo],
  );
  const { rows } = await query(
    'SELECT id, name, prenom, nom, email, role, poste, email_verified, photo FROM users WHERE id = $1',
    [id],
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

// POST /api/accounts/:id/resend-verify — patron re-sends the confirmation link
// to an account that hasn't confirmed its address yet. Issues a fresh verify
// token (invalidating any prior one) and re-emails it. Refused once the account
// is already confirmed, so it can't be used to churn credentials.
router.post('/:id/resend-verify', requirePatron, async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(
    'SELECT id, name, email, role, email_verified FROM users WHERE id = $1',
    [id],
  );
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'Compte introuvable' });
  if (user.email_verified) return res.status(409).json({ error: 'Compte déjà confirmé' });

  try {
    const token = await createToken(user.id, 'verify');
    await sendVerifyEmail({ name: user.name, email: user.email, role: user.role, token });
  } catch (err) {
    console.error('Brevo send failed:', err.message);
    return res.status(502).json({ error: "Échec de l'envoi de l'email — réessayez" });
  }

  res.json({ ok: true, emailed: true });
});

// PATCH /api/accounts/:id — patron edits an account (everything but the password)
router.patch('/:id', requirePatron, async (req, res) => {
  const { id } = req.params;
  const prenom = String(req.body?.prenom || '').trim();
  const nom = String(req.body?.nom || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const poste = String(req.body?.poste || '').trim();
  const role = sanitizeRole(req.body?.role);
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
  await query(
    `UPDATE users SET name = $1, prenom = $2, nom = $3, email = $4, poste = $5, role = $6, photo = $7
     WHERE id = $8`,
    [name, prenom, nom, email, poste, role, photo, id],
  );
  const { rows } = await query(
    'SELECT id, name, prenom, nom, email, role, poste, email_verified, photo FROM users WHERE id = $1',
    [id],
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
