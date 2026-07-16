import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { sendNewsletterToSubscribers } from '../mail.js';

const router = Router();

// 'team' retiré : les membres de la vitrine viennent désormais des comptes
// marqués « à la une » (voir GET /api/accounts/featured).
const TYPES = ['portfolio', 'blog', 'testimonials'];
const validType = (t) => TYPES.includes(t);

// Returns { id, views, ...data } — same shape the frontend used from localStorage.
const shape = (row) => ({ id: row.id, views: Number(row.views || 0), ...row.data });

// GET /api/content/stats/page-views — PUBLIC (consumed by Admin / stats)
router.get('/stats/page-views', async (req, res) => {
  const { rows } = await query('SELECT page, count FROM page_views WHERE page IN ($1, $2)', ['portfolio', 'blog']);
  const counts = { portfolio: 0, blog: 0 };
  rows.forEach((r) => { counts[r.page] = Number(r.count || 0); });
  res.json(counts);
});

// GET /api/content/:type — PUBLIC (consumed by public pages), newest first.
router.get('/:type', async (req, res) => {
  if (!validType(req.params.type)) return res.status(404).json({ error: 'Type inconnu' });
  if (!req.query.admin && (req.params.type === 'portfolio' || req.params.type === 'blog')) {
    query(
      `INSERT INTO page_views (page, count) VALUES ($1, 1)
       ON CONFLICT (page) DO UPDATE SET count = page_views.count + 1`,
      [req.params.type],
    ).catch(() => {});
  }
  const { rows } = await query(
    'SELECT id, data, views FROM content WHERE type = $1 ORDER BY created_at DESC',
    [req.params.type],
  );
  res.json(rows.map(shape));
});

// POST /api/content/:type/:id/view — PUBLIC (increment view for specific item)
router.post('/:type/:id/view', async (req, res) => {
  const { type, id } = req.params;
  if (!validType(type)) return res.status(404).json({ error: 'Type inconnu' });
  const { rows } = await query(
    'UPDATE content SET views = COALESCE(views, 0) + 1 WHERE id = $1 AND type = $2 RETURNING id, views',
    [id, type],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Introuvable' });
  res.json({ ok: true, views: Number(rows[0].views) });
});

// Everything below requires patron.
router.use(requireAuth, requireManager);

// POST /api/content/:type  body = the item object (without id)
router.post('/:type', async (req, res) => {
  const { type } = req.params;
  if (!validType(type)) return res.status(404).json({ error: 'Type inconnu' });
  const data = req.body && typeof req.body === 'object' ? req.body : {};
  delete data.id;
  delete data.views;

  const { rows } = await query(
    'INSERT INTO content (type, data, views) VALUES ($1, $2, 0) RETURNING id, data, views',
    [type, data],
  );
  if ((type === 'blog' || type === 'portfolio') && data.featured) await unfeatureOthers(rows[0].id, type);
  if (type === 'blog') notifySubscribers(data);
  res.status(201).json(shape(rows[0]));
});

// PUT /api/content/:type/:id
router.put('/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  if (!validType(type)) return res.status(404).json({ error: 'Type inconnu' });
  const data = req.body && typeof req.body === 'object' ? req.body : {};
  delete data.id;
  delete data.views;

  const { rows } = await query(
    'UPDATE content SET data = $1 WHERE id = $2 AND type = $3 RETURNING id, data, views',
    [data, id, type],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Introuvable' });
  if ((type === 'blog' || type === 'portfolio') && data.featured) await unfeatureOthers(id, type);
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

// Emails every newsletter subscriber about a freshly published blog post.
// Fire-and-forget: a Brevo failure must never fail the publish request.
function notifySubscribers(post) {
  query('SELECT email FROM newsletter_subscribers')
    .then(({ rows }) => {
      if (rows.length) return sendNewsletterToSubscribers(rows, { title: post.title, excerpt: post.excerpt });
    })
    .catch((err) => console.error('Newsletter notify failed:', err.message));
}

// Only one item of a given type may be "à la une" (blog article / portfolio project).
async function unfeatureOthers(keepId, type) {
  await query(
    `UPDATE content SET data = jsonb_set(data, '{featured}', 'false')
     WHERE type = $2 AND id <> $1 AND (data->>'featured')::boolean IS TRUE`,
    [keepId, type],
  );
}

export default router;
