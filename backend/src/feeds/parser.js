// Veille RSS : lecture de la config, fetch/parse/validation/catégorisation des
// flux, et enrichissement à la demande (og:image + corps d'article) au moment de
// publier. Un flux mort (URL HS ou non-XML) est signalé, jamais fatal.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Parser from 'rss-parser';
import { extract } from '@extractus/article-extractor';
import { query } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', '..', 'config', 'feeds.json');

// Rechargée à chaque appel : éditer feeds.json ne nécessite pas de redémarrage.
export function loadConfig() {
  const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  return {
    feeds: Array.isArray(raw.feeds) ? raw.feeds : [],
    denyKeywords: Array.isArray(raw.denyKeywords) ? raw.denyKeywords : [],
    maxAgeDays: Number.isFinite(raw.maxAgeDays) ? raw.maxAgeDays : 10,
  };
}
export function loadFeeds() { return loadConfig().feeds; }
export function getMaxAgeDays() { return loadConfig().maxAgeDays; }

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CodialisVeille/1.0; +RSS reader)' },
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['media:content', 'media', { keepArray: true }],
      ['media:thumbnail', 'thumb'],
    ],
  },
});

const stripAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s) => stripAccents(s).toLowerCase();
export const clean = (html = '') => String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// Catégorie par défaut = celle du flux. `refine` (flux multi-thématiques comme
// Maddyness) reclasse par mots-clés dans titre + résumé.
function categorize(feed, item) {
  let cat = feed.category;
  if (Array.isArray(feed.refine)) {
    const hay = norm(`${item.title} ${item.contentSnippet || item.summary || ''}`);
    for (const rule of feed.refine) {
      if (rule.keywords?.some((k) => hay.includes(norm(k)))) { cat = rule.category; break; }
    }
  }
  return cat;
}

// Image fournie par le flux lui-même (enclosure / media / 1re <img> du contenu).
function feedImage(item) {
  if (item.enclosure?.url && /^https?:/i.test(item.enclosure.url)) return item.enclosure.url;
  if (Array.isArray(item.media) && item.media[0]?.$?.url) return item.media[0].$.url;
  if (item.thumb?.$?.url) return item.thumb.$.url;
  const html = item.contentEncoded || item.content || '';
  const m = html.match(/<img[^>]+src="([^"]+)"/i);
  return m ? m[1] : '';
}

// Un article est-il assez récent ? (fenêtre maxAgeDays ; sans date = accepté,
// il vient d'être publié dans le flux). Trop vieux = ignoré.
function isFresh(publishedAt, maxAgeDays) {
  if (!publishedAt) return true;
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) return true;
  return (Date.now() - t) <= maxAgeDays * 86400000;
}
// Bruit grand public : titre/résumé contenant un mot de la denylist = exclu.
function isNoise(title, excerpt, denyNorm) {
  if (!denyNorm.length) return false;
  const hay = norm(`${title} ${excerpt}`);
  return denyNorm.some((k) => hay.includes(k));
}

async function fetchFeed(feed, denyNorm, maxAgeDays) {
  try {
    const f = await parser.parseURL(feed.url);
    let dropped = 0;
    const items = (f.items || [])
      .map((it) => {
        const link = it.link || it.guid || '';
        return {
          guid: it.guid || it.id || link,
          source: feed.label,
          category: categorize(feed, it),
          title: (it.title || '').trim(),
          excerpt: clean(it.contentSnippet || it.summary || it.content || '').slice(0, 400),
          content: it.contentEncoded || it.content || '', // corps complet si le flux le donne
          image: feedImage(it),
          link,
          published_at: it.isoDate || it.pubDate || null,
        };
      })
      .filter((x) => {
        if (!x.title || !x.link) return false;
        if (!isFresh(x.published_at, maxAgeDays)) { dropped++; return false; }   // trop vieux
        if (isNoise(x.title, x.excerpt, denyNorm)) { dropped++; return false; }  // grand public
        return true;
      });
    return { label: feed.label, ok: true, count: items.length, dropped, items };
  } catch (e) {
    return { label: feed.label, ok: false, count: 0, dropped: 0, error: e.message, items: [] };
  }
}

// Fetch tous les flux + upsert. Léger : RSS seulement (pas d'enrichissement ici).
// Dédup sur guid ; on ne réécrit jamais un item existant (garde statut / recat manuelle).
export async function refreshAll() {
  const { feeds, denyKeywords, maxAgeDays } = loadConfig();
  const denyNorm = denyKeywords.map(norm).filter(Boolean);
  const results = await Promise.all(feeds.map((f) => fetchFeed(f, denyNorm, maxAgeDays)));
  let added = 0;
  for (const r of results) {
    for (const it of r.items) {
      const { rowCount } = await query(
        `INSERT INTO feed_items (guid, source, category, title, excerpt, content, image, link, published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (guid) DO NOTHING`,
        [it.guid, it.source, it.category, it.title, it.excerpt, it.content, it.image, it.link, it.published_at],
      );
      added += rowCount;
    }
  }
  // Purge les suggestions non traitées devenues trop vieilles (fenêtre glissante).
  // On ne touche jamais aux items 'published'/'ignored'/'later'.
  const purged = await query(
    `DELETE FROM feed_items
     WHERE status = 'new' AND published_at IS NOT NULL
       AND published_at < now() - ($1 || ' days')::interval`,
    [String(maxAgeDays)],
  );
  return {
    added,
    purged: purged.rowCount,
    total: results.reduce((n, r) => n + r.count, 0),
    feeds: results.map((r) => ({ label: r.label, ok: r.ok, count: r.count, dropped: r.dropped || 0, error: r.error || null })),
  };
}

// Garde SSRF : n'enrichir que des URLs http(s) dont l'hôte appartient à un flux
// configuré (les liens viennent du flux, mais on ne fait confiance à rien).
function feedHosts() {
  return loadFeeds()
    .map((f) => { try { return new URL(f.url).hostname.replace(/^www\./, ''); } catch { return null; } })
    .filter(Boolean);
}
function hostAllowed(link) {
  try {
    const u = new URL(link);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.replace(/^www\./, '');
    return feedHosts().some((h) => host === h || host.endsWith(`.${h}`));
  } catch { return false; }
}

// B : enrichir un item — récupère og:image + corps de l'article depuis la page
// source quand le flux ne les fournit pas. N'écrase jamais une valeur du flux
// plus riche. Retourne { image, content } ; en cas d'échec, garde les valeurs du flux.
export async function enrich(item) {
  let image = item.image || '';
  let content = item.content || '';
  const needsMore = !image || clean(content).length < 400;
  if (needsMore && hostAllowed(item.link)) {
    try {
      const art = await extract(item.link, {}, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (art) {
        if (!image && art.image) image = art.image;
        if (clean(art.content || '').length > clean(content).length) content = art.content || content;
      }
    } catch { /* la page peut bloquer / timeouter : on garde ce qu'on a */ }
  }
  return { image, content };
}
