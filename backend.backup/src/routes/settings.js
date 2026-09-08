import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireManager } from '../middleware/auth.js';

const router = Router();

// Allowed singleton keys. Add new page-level blobs here.
const KEYS = ['portfolio_page', 'blog_page', 'contact_socials', 'home_logos'];
const validKey = (k) => KEYS.includes(k);

// GET /api/settings/:key — PUBLIC (consumed by public pages).
// Returns the stored object, or {} when nothing has been saved yet.
router.get('/:key', async (req, res) => {
  if (!validKey(req.params.key)) return res.status(404).json({ error: 'Clé inconnue' });
  const { rows } = await query('SELECT data FROM settings WHERE `key` = $1', [req.params.key]);
  // Réglages de page publics : cacheables côté navigateur (override du no-store
  // global) pour accélérer les visites répétées.
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json(rows.length ? rows[0].data : {});
});

// Everything below requires patron.
router.use(requireAuth, requireManager);

// PUT /api/settings/:key  body = the whole settings object. Upserts.
router.put('/:key', async (req, res) => {
  const { key } = req.params;
  if (!validKey(key)) return res.status(404).json({ error: 'Clé inconnue' });
  const data = req.body && typeof req.body === 'object' ? req.body : {};
  await query(
    'INSERT INTO settings (`key`, data) VALUES ($1, $2) ' +
      'ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = CURRENT_TIMESTAMP',
    [key, JSON.stringify(data)],
  );
  const { rows } = await query('SELECT data FROM settings WHERE `key` = $1', [key]);
  res.json(rows[0].data);
});

export default router;
