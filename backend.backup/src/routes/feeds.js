import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { refreshAll, enrich, clean, getMaxAgeDays } from '../feeds/parser.js';

const router = Router();

// Toute la veille est réservée à la direction (comme l'écriture de contenu).
router.use(requireAuth, requireManager);

// Catégorie Veille -> `cat` du blog existant. Les 5 catégories en plus
// (cyber/startups/data/mobile/opensource) passent telles quelles : le blog
// gère les catégories personnalisées.
const CAT_MAP = { development: 'dev', ia: 'ia', saas: 'saas', funding: 'funding', design: 'design' };
const toBlogCat = (c) => CAT_MAP[c] || c;

const VALID_STATUS = ['new', 'ignored', 'later', 'published'];

// Convertit le HTML d'article en texte lisible (le blog rend l'extrait en
// texte pre-wrap, pas en HTML) : on garde les sauts de paragraphe.
function htmlToText(html = '') {
  return String(html)
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// GET /api/feeds/items?status=new&category=ia&q=texte
router.get('/items', async (req, res) => {
  const status = VALID_STATUS.includes(req.query.status) ? req.query.status : 'new';
  const params = [status];
  let sql = 'SELECT id, guid, source, category, title, excerpt, image, link, published_at, status FROM feed_items WHERE status = $1';
  // Fenêtre de fraîcheur : uniquement les articles récents (sans date = gardés).
  const params0 = params.length;
  params.push(getMaxAgeDays());
  sql += ` AND (published_at IS NULL OR published_at >= now() - INTERVAL $${params0 + 1} DAY)`;
  if (req.query.category && req.query.category !== 'all') {
    params.push(req.query.category);
    sql += ` AND category = $${params.length}`;
  }
  const q = (req.query.q || '').trim();
  if (q) {
    params.push(`%${q}%`);
    sql += ` AND (title ILIKE $${params.length} OR excerpt ILIKE $${params.length})`;
  }
  // MySQL sorts NULLs last on DESC, so no explicit NULLS LAST needed.
  sql += ' ORDER BY published_at DESC, fetched_at DESC LIMIT 200';
  const { rows } = await query(sql, params);
  res.json(rows);
});

// GET /api/feeds/counts — nombre d'items "new" par catégorie (pour les pills).
router.get('/counts', async (req, res) => {
  const { rows } = await query(
    "SELECT category, count(*)::int AS n FROM feed_items WHERE status = 'new' GROUP BY category",
  );
  const byCat = {};
  let total = 0;
  rows.forEach((r) => { byCat[r.category] = r.n; total += r.n; });
  res.json({ total, byCat });
});

// POST /api/feeds/refresh — fetch + parse + upsert tous les flux (léger, RSS seul).
router.post('/refresh', async (req, res) => {
  try {
    const summary = await refreshAll();
    res.json(summary);
  } catch (err) {
    console.error('Feed refresh failed:', err.message);
    res.status(500).json({ error: 'Échec du rafraîchissement des flux' });
  }
});

// GET /api/feeds/items/:id/prefill — enrichit (og:image + corps si manquants)
// et renvoie un objet prêt à pré-remplir le formulaire de création d'article.
router.get('/items/:id/prefill', async (req, res) => {
  const { rows } = await query('SELECT * FROM feed_items WHERE id = $1', [req.params.id]);
  const item = rows[0];
  if (!item) return res.status(404).json({ error: 'Introuvable' });

  const { image, content } = await enrich(item);
  const bodyText = htmlToText(content) || item.excerpt || '';

  // Mémorise l'enrichissement pour un prochain affichage instantané.
  if (image !== item.image || content !== item.content) {
    query('UPDATE feed_items SET image = $1, content = $2 WHERE id = $3', [image, content, item.id]).catch(() => {});
  }

  const d = item.published_at ? new Date(item.published_at) : null;
  const words = clean(bodyText).split(/\s+/).filter(Boolean).length;
  res.json({
    cat: toBlogCat(item.category),
    title: item.title,
    excerpt: item.excerpt,
    content: bodyText,
    image,
    source: item.link,
    date: d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '',
    read: `${Math.max(1, Math.round(words / 200))} min`,
    featured: false,
  });
});

// PATCH /api/feeds/items/:id  body {status} et/ou {category}
router.patch('/items/:id', async (req, res) => {
  const fields = [];
  const params = [];
  if (req.body?.status !== undefined) {
    if (!VALID_STATUS.includes(req.body.status)) return res.status(400).json({ error: 'Statut invalide' });
    params.push(req.body.status);
    fields.push(`status = $${params.length}`);
  }
  if (req.body?.category !== undefined) {
    params.push(String(req.body.category));
    fields.push(`category = $${params.length}`);
  }
  if (!fields.length) return res.status(400).json({ error: 'Rien à mettre à jour' });
  params.push(req.params.id);
  await query(`UPDATE feed_items SET ${fields.join(', ')} WHERE id = $${params.length}`, params);
  const { rows } = await query('SELECT id, status, category FROM feed_items WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Introuvable' });
  res.json(rows[0]);
});

export default router;
