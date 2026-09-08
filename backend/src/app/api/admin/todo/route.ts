import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Écran « À traiter » — réservé à la direction.
//
// La lecture renvoie les lignes brutes : les comptages, totaux et regroupements
// par catégorie restent calculés à l'affichage, là où ils sont utilisés.

export const GET = adminRoute(["DIR"], async () => ({
  items: await prisma.actionItem.findMany({
    include: { linkedProject: { include: { client: true } } },
    orderBy: { createdAt: "asc" },
  }),
}));

const toggleSchema = z.object({
  action: z.literal("toggle"),
  itemId: z.string().min(1),
});

export const POST = adminRoute(["DIR"], async (_ctx, request) => {
  const parsed = toggleSchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");

  // On bascule d'après l'état lu en base, pas d'après celui que le client
  // croyait voir : deux clics concurrents ne peuvent pas se contredire.
  const item = await prisma.actionItem.findUnique({
    where: { id: parsed.data.itemId },
    select: { done: true },
  });
  if (!item) badRequest("Action introuvable");

  await prisma.actionItem.update({
    where: { id: parsed.data.itemId },
    data: { done: !item.done },
  });
});
