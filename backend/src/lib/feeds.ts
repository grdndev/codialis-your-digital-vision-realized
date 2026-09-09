import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Parser from "rss-parser";
import { extract } from "@extractus/article-extractor";
import { prisma } from "@/lib/prisma";

// Veille : lecture de la configuration, rafraîchissement des flux, puis
// enrichissement à la demande au moment de publier.
//
// Un flux mort (URL hors service, réponse non-XML, timeout) est signalé dans le
// résumé du rafraîchissement mais n'interrompt jamais les autres : c'est le
// point le plus important de ce module, une veille qui tombe entière parce
// qu'un seul site est en panne ne sert à rien.

type FeedConfig = {
  label: string;
  url: string;
  category: string;
  // Les flux multi-thématiques se reclassent par mots-clés.
  refine?: { category: string; keywords: string[] }[];
};

type Config = { feeds: FeedConfig[]; denyKeywords: string[]; maxAgeDays: number };

const CONFIG_PATH = join(process.cwd(), "config", "feeds.json");
const DEFAULT_MAX_AGE_DAYS = 10;

// Relue à chaque appel : éditer config/feeds.json ne demande pas de redémarrage.
export function loadConfig(): Config {
  const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  return {
    feeds: Array.isArray(raw.feeds) ? raw.feeds : [],
    denyKeywords: Array.isArray(raw.denyKeywords) ? raw.denyKeywords : [],
    maxAgeDays: Number.isFinite(raw.maxAgeDays) ? raw.maxAgeDays : DEFAULT_MAX_AGE_DAYS,
  };
}

export function getMaxAgeDays(): number {
  return loadConfig().maxAgeDays;
}

// Catégories de veille -> catégories du blog. Les catégories de veille en plus
// (cyber, startups, data, opensource…) passent telles quelles : le blog gère
// des catégories personnalisées.
const BLOG_CATEGORY: Record<string, string> = {
  development: "dev",
  ia: "ia",
  saas: "saas",
  funding: "funding",
  design: "design",
};

export function toBlogCategory(category: string): string {
  return BLOG_CATEGORY[category] ?? category;
}

const parser: Parser<Record<string, unknown>, Record<string, unknown>> = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; CodialisVeille/1.0; +RSS reader)" },
  customFields: {
    item: [
      ["content:encoded", "contentEncoded"],
      ["media:content", "media", { keepArray: true }],
      ["media:thumbnail", "thumb"],
    ],
  },
});

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s: unknown) => stripAccents(String(s ?? "")).toLowerCase();

// Retire le balisage : les extraits sont rendus en texte, pas en HTML.
export function clean(html: string | null | undefined): string {
  return String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Convertit le HTML d'un article en texte lisible, en gardant les sauts de
// paragraphe : le blog rend le corps en pre-wrap, pas en HTML.
export function htmlToText(html: string | null | undefined): string {
  return String(html ?? "")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

type RawItem = Record<string, unknown> & {
  title?: string;
  link?: string;
  guid?: string;
  id?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  contentEncoded?: string;
  isoDate?: string;
  pubDate?: string;
  enclosure?: { url?: string };
  media?: { $?: { url?: string } }[];
  thumb?: { $?: { url?: string } };
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

// La catégorie par défaut est celle du flux ; `refine` la reclasse sur les
// mots-clés trouvés dans le titre et le résumé.
function categorize(feed: FeedConfig, item: RawItem): string {
  if (!Array.isArray(feed.refine)) return feed.category;
  const hay = norm(`${item.title ?? ""} ${item.contentSnippet ?? item.summary ?? ""}`);
  for (const rule of feed.refine) {
    if (rule.keywords?.some((k) => hay.includes(norm(k)))) return rule.category;
  }
  return feed.category;
}

// Image fournie par le flux lui-même : pièce jointe, media:*, ou première
// balise img du contenu.
function feedImage(item: RawItem): string {
  if (item.enclosure?.url && /^https?:/i.test(item.enclosure.url)) return item.enclosure.url;
  if (Array.isArray(item.media) && item.media[0]?.$?.url) return item.media[0].$.url;
  if (item.thumb?.$?.url) return item.thumb.$.url;
  const html = item.contentEncoded || item.content || "";
  const match = html.match(/<img[^>]+src="([^"]+)"/i);
  return match ? match[1] : "";
}

// Fenêtre de fraîcheur. Un article sans date est accepté : il vient d'arriver
// dans le flux, c'est le seul signal qu'on a.
function isFresh(publishedAt: Date | null, maxAgeDays: number): boolean {
  if (!publishedAt) return true;
  return Date.now() - publishedAt.getTime() <= maxAgeDays * 86_400_000;
}

// Bruit grand public : bons plans, soldes, dates de sortie… La liste vit dans
// config/feeds.json, éditable sans toucher au code.
function isNoise(title: string, excerpt: string, denyNorm: string[]): boolean {
  if (denyNorm.length === 0) return false;
  const hay = norm(`${title} ${excerpt}`);
  return denyNorm.some((k) => hay.includes(k));
}

export type FeedResult = {
  label: string;
  ok: boolean;
  count: number;
  dropped: number;
  error: string | null;
};

type ParsedItem = {
  guid: string;
  source: string;
  category: string;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  link: string;
  publishedAt: Date | null;
};

async function fetchFeed(
  feed: FeedConfig,
  denyNorm: string[],
  maxAgeDays: number,
): Promise<FeedResult & { items: ParsedItem[] }> {
  try {
    const parsed = await parser.parseURL(feed.url);
    let dropped = 0;
    const items: ParsedItem[] = [];

    for (const raw of (parsed.items ?? []) as RawItem[]) {
      const link = raw.link || raw.guid || "";
      const title = (raw.title ?? "").trim();
      const excerpt = clean(raw.contentSnippet || raw.summary || raw.content).slice(0, 400);
      const publishedAt = toDate(raw.isoDate || raw.pubDate);

      // Sans titre ni lien il n'y a rien à trier ni à ouvrir.
      if (!title || !link) continue;
      if (!isFresh(publishedAt, maxAgeDays)) {
        dropped++;
        continue;
      }
      if (isNoise(title, excerpt, denyNorm)) {
        dropped++;
        continue;
      }

      items.push({
        guid: (raw.guid || raw.id || link).slice(0, 512),
        source: feed.label.slice(0, 255),
        category: categorize(feed, raw).slice(0, 64),
        title: title.slice(0, 512),
        excerpt,
        content: raw.contentEncoded || raw.content || "",
        image: feedImage(raw).slice(0, 2048),
        link: link.slice(0, 1024),
        publishedAt,
      });
    }

    return { label: feed.label, ok: true, count: items.length, dropped, error: null, items };
  } catch (err) {
    // Un flux en panne ne doit pas faire échouer le rafraîchissement.
    const message = err instanceof Error ? err.message : String(err);
    return { label: feed.label, ok: false, count: 0, dropped: 0, error: message, items: [] };
  }
}

export type RefreshSummary = {
  added: number;
  purged: number;
  total: number;
  feeds: FeedResult[];
};

// Rafraîchit tous les flux. Volontairement léger : RSS seulement, aucun
// enrichissement — celui-ci coûte une requête HTTP par article et n'a de sens
// qu'au moment de publier.
export async function refreshAll(): Promise<RefreshSummary> {
  const { feeds, denyKeywords, maxAgeDays } = loadConfig();
  const denyNorm = denyKeywords.map(norm).filter(Boolean);

  const results = await Promise.all(feeds.map((f) => fetchFeed(f, denyNorm, maxAgeDays)));

  const all = results.flatMap((r) => r.items);
  // `skipDuplicates` sur `guid` : on ne réécrit JAMAIS un article existant, son
  // statut et sa recatégorisation manuelle doivent survivre au rafraîchissement.
  const { count: added } = await prisma.feedItem.createMany({
    data: all.map((it) => ({
      guid: it.guid,
      source: it.source,
      category: it.category,
      title: it.title,
      excerpt: it.excerpt,
      content: it.content,
      image: it.image,
      link: it.link,
      publishedAt: it.publishedAt,
    })),
    skipDuplicates: true,
  });

  // Fenêtre glissante : les suggestions non triées devenues trop vieilles
  // disparaissent. On ne touche jamais à ce qui a été trié.
  const cutoff = new Date(Date.now() - maxAgeDays * 86_400_000);
  const { count: purged } = await prisma.feedItem.deleteMany({
    where: { status: "NEW", publishedAt: { not: null, lt: cutoff } },
  });

  return {
    added,
    purged,
    total: results.reduce((n, r) => n + r.count, 0),
    feeds: results.map(({ label, ok, count, dropped, error }) => ({
      label,
      ok,
      count,
      dropped,
      error,
    })),
  };
}

// Garde anti-SSRF : on n'enrichit qu'une URL http(s) dont l'hôte appartient à
// un flux configuré. Les liens viennent du flux, mais un flux compromis ne doit
// pas pouvoir faire émettre au serveur une requête vers un hôte arbitraire.
function hostAllowed(link: string): boolean {
  const hosts = loadConfig()
    .feeds.map((f) => {
      try {
        return new URL(f.url).hostname.replace(/^www\./, "");
      } catch {
        return null;
      }
    })
    .filter((h): h is string => h !== null);

  try {
    const u = new URL(link);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.replace(/^www\./, "");
    return hosts.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

// Seuil en dessous duquel on considère que le flux n'a donné qu'un résumé et
// qu'il vaut la peine d'aller chercher l'article.
const SHORT_CONTENT = 400;

// Récupère l'image et le corps depuis la page source quand le flux ne les
// fournit pas. N'écrase jamais une valeur du flux plus riche ; en cas d'échec,
// garde ce qu'on a — la page peut bloquer ou expirer.
export async function enrich(item: {
  link: string;
  image: string | null;
  content: string | null;
}): Promise<{ image: string; content: string }> {
  let image = item.image ?? "";
  let content = item.content ?? "";

  const needsMore = !image || clean(content).length < SHORT_CONTENT;
  if (needsMore && hostAllowed(item.link)) {
    try {
      const article = await extract(item.link, {}, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (article) {
        if (!image && article.image) image = article.image;
        if (clean(article.content).length > clean(content).length) {
          content = article.content ?? content;
        }
      }
    } catch {
      // La page peut bloquer, expirer, ou ne rien donner d'exploitable.
    }
  }

  return { image, content };
}
