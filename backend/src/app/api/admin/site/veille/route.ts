import { z } from "zod";
import { adminRoute, badRequest, jsonBody, notFound } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { getMaxAgeDays, refreshAll } from "@/lib/feeds";

export const dynamic = "force-dynamic";

// Veille : la file de suggestions issues des flux RSS, à trier avant d'en
// publier un article. Direction et chefferie de projet, comme l'écriture de
// contenu.

const STATUSES = ["NEW", "IGNORED", "LATER", "PUBLISHED"] as const;
const LIST_LIMIT = 200;

export const GET = adminRoute(["PM", "DIR"], async (_ctx, request) => {
  const params = request.nextUrl.searchParams;
  const statusParam = params.get("status");
  const status = (STATUSES as readonly string[]).includes(statusParam ?? "")
    ? (statusParam as (typeof STATUSES)[number])
    : "NEW";
  const category = params.get("category");
  const search = (params.get("q") ?? "").trim();

  // Fenêtre de fraîcheur : on n'affiche que des articles récents. Un article
  // sans date est gardé — il vient d'arriver dans le flux.
  const cutoff = new Date(Date.now() - getMaxAgeDays() * 86_400_000);

  const [items, counts] = await Promise.all([
    prisma.feedItem.findMany({
      where: {
        status,
        OR: [{ publishedAt: null }, { publishedAt: { gte: cutoff } }],
        ...(category && category !== "all" ? { category } : {}),
        ...(search
          ? { OR: [{ title: { contains: search } }, { excerpt: { contains: search } }] }
          : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
      take: LIST_LIMIT,
    }),
    // Compteurs par catégorie, pour les pastilles de filtrage.
    prisma.feedItem.groupBy({ by: ["category"], where: { status: "NEW" }, _count: true }),
  ]);

  return {
    items,
    counts: {
      total: counts.reduce((n, c) => n + c._count, 0),
      byCategory: Object.fromEntries(counts.map((c) => [c.category, c._count])),
    },
    maxAgeDays: getMaxAgeDays(),
  };
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("refresh") }),
  z.object({
    action: z.literal("set-status"),
    itemId: z.string().min(1),
    status: z.enum(STATUSES),
  }),
  z.object({
    action: z.literal("set-category"),
    itemId: z.string().min(1),
    category: z.string().min(1).max(64),
  }),
]);

export const POST = adminRoute(["PM", "DIR"], async (_ctx, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  if (body.action === "refresh") {
    try {
      // Le résumé dit quel flux a répondu et lesquels sont en panne : c'est la
      // seule façon de s'apercevoir qu'une source est morte.
      return await refreshAll();
    } catch (err) {
      console.error("Rafraîchissement de la veille en échec:", err);
      badRequest("Échec du rafraîchissement des flux");
    }
  }

  const exists = await prisma.feedItem.findUnique({
    where: { id: body.itemId },
    select: { id: true },
  });
  if (!exists) notFound("Article introuvable");

  if (body.action === "set-status") {
    await prisma.feedItem.update({ where: { id: body.itemId }, data: { status: body.status } });
    return;
  }

  await prisma.feedItem.update({ where: { id: body.itemId }, data: { category: body.category } });
});
