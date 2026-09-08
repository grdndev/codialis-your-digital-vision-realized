import { prisma } from "@/lib/prisma";
import { apiError, apiJson, apiPreflight } from "@/lib/public-api";
import { isContentType } from "@/lib/site-content";

export const dynamic = "force-dynamic";

// POST /api/content/:type/:id/view — le site appelle cette route quand un
// visiteur ouvre un article ou un projet, pour incrémenter son compteur.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;
  if (!isContentType(type)) return apiError(request, "Type inconnu", 404);

  // updateMany plutôt qu'update : le couple (id, type) n'est pas une clé
  // unique, et un id inconnu doit répondre 404 au lieu de lever.
  const { count } = await prisma.content.updateMany({
    where: { id, type },
    data: { views: { increment: BigInt(1) } },
  });
  if (count === 0) return apiError(request, "Introuvable", 404);

  const row = await prisma.content.findUnique({ where: { id }, select: { views: true } });
  return apiJson(
    request,
    { ok: true, views: Number(row?.views ?? 0) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function OPTIONS(request: Request) {
  return apiPreflight(request, "POST");
}
