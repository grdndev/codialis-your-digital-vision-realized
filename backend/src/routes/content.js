import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requirePatron } from '../middleware/auth.js';

const router = Router();

const TYPES = ['portfolio', 'blog', 'testimonials', 'team'];
const validType = (t) => TYPES.includes(t);

// Returns { id, ...data } — same shape the frontend used from localStorage.
const shape = (row) => ({ id: row.id, ...row.data });

// GET /api/content/:type — PUBLIC (consumed by public pages), newest first.
router.get('/:type', async (req, res) => {
  if (!validType(req.params.type)) return res.status(404).json({ error: 'Type inconnu' });
  const { rows } = await query(
    'SELECT id, data FROM content WHERE type = $1 ORDER BY created_at DESC',
    [req.params.type],
  );
  res.json(rows.map(shape));
});

// Everything below requires patron.
router.use(requireAuth, requirePatron);

// POST /api/content/:type  body = the item object (without id)
router.post('/:type', async (req, res) => {
  const { type } = req.params;
  if (!validType(type)) return res.status(404).json({ error: 'Type inconnu' });
  const data = req.body && typeof req.body === 'object' ? req.body : {};
  delete data.id;

  const { rows } = await query(
    'INSERT INTO content (type, data) VALUES ($1, $2) RETURNING id, data',
    [type, data],
  );
  if (type === 'blog' && data.featured) await unfeatureOthers(rows[0].id);
  res.status(201).json(shape(rows[0]));
});

// PUT /api/content/:type/:id
router.put('/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  if (!validType(type)) return res.status(404).json({ error: 'Type inconnu' });
  const data = req.body && typeof req.body === 'object' ? req.body : {};
  delete data.id;

  const { rows } = await query(
    'UPDATE content SET data = $1 WHERE id = $2 AND type = $3 RETURNING id, data',
    [data, id, type],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Introuvable' });
  if (type === 'blog' && data.featured) await unfeatureOthers(id);
  res.json(shape(rows[0]));
});

// DELETE /api/content/:type/:id
router.delete('/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  if (!validType(type)) return res.status(404).json({ error: 'Type inconnu' });
  const { rowCount } = await query('DELETE FROM content WHERE id = $1 AND type = $2', [id, type]);
  if (rowCount === 0) return res.status(404).json({ error: 'Introuvable' });
  res.json({ ok: true });
});

// Only one blog post may be "à la une".
async function unfeatureOthers(keepId) {
  await query(
    `UPDATE content SET data = jsonb_set(data, '{featured}', 'false')
     WHERE type = 'blog' AND id <> $1 AND (data->>'featured')::boolean IS TRUE`,
    [keepId],
  );
}

export default router;
