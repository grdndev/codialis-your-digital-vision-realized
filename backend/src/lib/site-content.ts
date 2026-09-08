import type { Prisma } from "@prisma/client";

// Types de contenu éditorial du site vitrine. Le `type` stocké en base est la
// chaîne exacte que le site utilise dans son URL (/api/content/blog…).
export const CONTENT_TYPES = ["portfolio", "blog", "testimonials"] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export function isContentType(value: string): value is ContentType {
  return (CONTENT_TYPES as readonly string[]).includes(value);
}

// Les pages qui tiennent un compteur de vues global (les témoignages n'en ont
// pas : ils sont affichés dans le carrousel de la page d'accueil).
export const VIEWED_PAGES: readonly string[] = ["portfolio", "blog"];

type ContentRow = { id: string; data: Prisma.JsonValue; views: bigint };

// Aplatit la ligne en `{ id, views, ...data }` — la forme que le site
// consommait quand ces objets étaient codés en dur dans les pages.
// `views` est un BIGINT : il faut le repasser en Number, JSON.stringify ne sait
// pas sérialiser un bigint.
export function shapeContent(row: ContentRow): Record<string, unknown> {
  const data = row.data && typeof row.data === "object" && !Array.isArray(row.data) ? row.data : {};
  return { id: row.id, views: Number(row.views), ...data };
}
