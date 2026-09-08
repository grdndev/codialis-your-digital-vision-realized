import { prisma } from "@/lib/prisma";
import { PUBLIC_CACHE, apiError, apiJson, apiPreflight } from "@/lib/public-api";

export const dynamic = "force-dynamic";

// Clés de réglages de page lues par le site vitrine. La liste est fermée : une
// clé inconnue répond 404 plutôt que d'exposer n'importe quelle ligne.
const KEYS = ["portfolio_page", "blog_page", "contact_socials", "home_logos"];

// GET /api/settings/:key — renvoie l'objet stocké, ou {} si rien n'a été
// enregistré. Le site distingue les deux : sans clé `items`, il garde ses
// valeurs par défaut codées dans la page.
export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!KEYS.includes(key)) return apiError(request, "Clé inconnue", 404);

  const row = await prisma.setting.findUnique({ where: { key }, select: { data: true } });
  return apiJson(request, row?.data ?? {}, { headers: { "Cache-Control": PUBLIC_CACHE } });
}

export async function OPTIONS(request: Request) {
  return apiPreflight(request, "GET");
}
