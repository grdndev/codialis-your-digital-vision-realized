import { z } from "zod";
import { adminRoute, badRequest, notFound } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { clean, enrich, htmlToText, toBlogCategory } from "@/lib/feeds";

export const dynamic = "force-dynamic";

// GET /api/admin/site/veille/prefill?itemId=
//
// Prépare un brouillon d'article de blog à partir d'un article de veille :
// l'enrichissement va chercher l'image et le corps sur la page source quand le
// flux ne les donne pas. La forme renvoyée est celle que le formulaire du blog
// attend, champ pour champ.

const WORDS_PER_MINUTE = 200;
const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const querySchema = z.object({ itemId: z.string().min(1) });

export const GET = adminRoute(["PM", "DIR"], async (_ctx, request) => {
  const parsed = querySchema.safeParse({ itemId: request.nextUrl.searchParams.get("itemId") });
  if (!parsed.success) badRequest("Requête invalide");

  const item = await prisma.feedItem.findUnique({ where: { id: parsed.data.itemId } });
  if (!item) notFound("Article introuvable");

  const { image, content } = await enrich(item);

  // On mémorise l'enrichissement : le prochain affichage est instantané, et on
  // ne redemande pas la page source pour rien.
  if (image !== item.image || content !== item.content) {
    prisma.feedItem
      .update({ where: { id: item.id }, data: { image, content } })
      .catch((err) => console.error("Mémorisation de l'enrichissement en échec:", err));
  }

  const body = htmlToText(content) || item.excerpt || "";
  const words = clean(body).split(/\s+/).filter(Boolean).length;

  return {
    draft: {
      cat: toBlogCategory(item.category),
      title: item.title,
      excerpt: item.excerpt ?? "",
      content: body,
      image,
      // Le lien d'origine devient la source citée sous l'article.
      source: item.link,
      date: item.publishedAt ? DATE_FORMATTER.format(item.publishedAt) : "",
      read: `${Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min`,
      featured: false,
    },
  };
});
