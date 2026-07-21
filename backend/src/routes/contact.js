import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { query } from '../db.js';
import { requireAuth, requireManager } from '../middleware/auth.js';

const router = Router();

const STATUSES = ['nouveau', 'en_cours', 'traite'];

// POST /api/contact — PUBLIC (formulaire de la page /contact).
router.post('/', async (req, res) => {
  const b = req.body || {};
  const clip = (v, max) => String(v ?? '').trim().slice(0, max);
  const name = clip(b.name, 200);
  const email = clip(b.email, 320);
  const message = clip(b.message, 5000);

  if (!name || !message) return res.status(400).json({ error: 'Nom et message obligatoires' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Email invalide' });

  const id = randomUUID();
  await query(
    `INSERT INTO contact_requests (id, name, company, email, phone, project, budget, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, name, clip(b.company, 200), email, clip(b.phone, 60), clip(b.project, 100), clip(b.budget, 60), message],
  );
  res.status(201).json({ ok: true, id });
});

// Tout ce qui suit est réservé au patron.
router.use(requireAuth, requireManager);

// GET /api/contact — liste, plus récentes d'abord.
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, company, email, phone, project, budget, message, status,
            created_at AS "createdAt"
     FROM contact_requests ORDER BY created_at DESC`,
  );
  res.json(rows);
});

// PATCH /api/contact/:id — change le statut de traitement.
router.patch('/:id', async (req, res) => {
  const status = String(req.body?.status || '');
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Statut invalide' });
  const { rowCount } = await query(
    'UPDATE contact_requests SET status = $1 WHERE id = $2',
    [status, req.params.id],
  );
  if (rowCount === 0) return res.status(404).json({ error: 'Introuvable' });
  res.json({ ok: true });
});

// DELETE /api/contact/:id
router.delete('/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM contact_requests WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Introuvable' });
  res.json({ ok: true });
});

export default router;
