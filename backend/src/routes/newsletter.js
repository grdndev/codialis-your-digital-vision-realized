import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requirePatron } from '../middleware/auth.js';
import { verifyUnsubscribe } from '../tokens.js';

const router = Router();

// POST /api/newsletter/subscribe — PUBLIC (blog page form).
router.post('/subscribe', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Email invalide' });

  await query(
    'INSERT INTO newsletter_subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
    [email],
  );
  res.status(201).json({ ok: true });
});

// GET /api/newsletter/unsubscribe?email=&token= — PUBLIC (link clicked from the emailed newsletter).
// The token is a stateless HMAC of the email (see tokens.js), so no lookup is
// needed to trust the request. Renders a small HTML page since a browser lands here directly.
router.get('/unsubscribe', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  const token = String(req.query.token || '');
  const page = (status, title, message) => res.status(status).send(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
    <title>${title} — Codialis</title>
    <meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#08111e;color:#eaf0f7;font-family:Arial,Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
    <div style="max-width:420px;padding:40px 32px;text-align:center">
      <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
      <p style="font-size:14px;color:#a6b3c6;line-height:1.6;margin:0">${message}</p>
    </div></body></html>`);

  if (!verifyUnsubscribe(email, token)) return page(400, 'Lien invalide', "Ce lien de désinscription n'est plus valide.");

  await query('DELETE FROM newsletter_subscribers WHERE email = $1', [email]);
  page(200, 'Désinscription confirmée', `${email} a bien été retiré de la newsletter Codialis.`);
});

// Everything below requires patron.
router.use(requireAuth, requirePatron);

// GET /api/newsletter — list subscribers, newest first.
router.get('/', async (req, res) => {
  const { rows } = await query(
    'SELECT id, email, created_at AS "createdAt" FROM newsletter_subscribers ORDER BY created_at DESC',
  );
  res.json(rows);
});

// DELETE /api/newsletter/:id
router.delete('/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM newsletter_subscribers WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Introuvable' });
  res.json({ ok: true });
});

export default router;
