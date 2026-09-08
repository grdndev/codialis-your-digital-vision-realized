import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { PUBLIC_CACHE, apiError, apiJson, apiPreflight } from "@/lib/public-api";
import { VIEWED_PAGES, isContentType, shapeContent } from "@/lib/site-content";

export const dynamic = "force-dynamic";

// GET /api/content/:type — portfolio, blog ou témoignages, du plus récent au
// plus ancien. `?admin=1` sert à consulter la liste sans compter la visite.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  if (!isContentType(type)) return apiError(request, "Type inconnu", 404);

  const isAdminRead = !!request.nextUrl.searchParams.get("admin");
  if (!isAdminRead && VIEWED_PAGES.includes(type)) {
    // Un compteur de vues qui échoue ne doit jamais empêcher la page de
    // s'afficher : on avale l'erreur.
    await prisma.pageView
      .upsert({
        where: { page: type },
        create: { page: type, count: BigInt(1) },
        update: { count: { increment: BigInt(1) } },
      })
      .catch(() => {});
  }

  const rows = await prisma.content.findMany({
    where: { type },
    select: { id: true, data: true, views: true },
    orderBy: { createdAt: "desc" },
  });

  return apiJson(request, rows.map(shapeContent), {
    headers: { "Cache-Control": PUBLIC_CACHE },
  });
}

export async function OPTIONS(request: Request) {
  return apiPreflight(request, "GET");
}
