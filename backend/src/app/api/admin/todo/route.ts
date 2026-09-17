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
  // Rattacher une action à un projet est facultatif, mais le choix doit être
  // proposé : c'est ce qui rend la carte cliquable vers la fiche projet.
  projects: await prisma.project.findMany({
    include: { client: true },
    orderBy: { name: "asc" },
  }),
}));

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("toggle"), itemId: z.string().min(1) }),
  z.object({
    action: z.literal("update"),
    itemId: z.string().min(1),
    category: z.enum(["URGENT", "RELANCE", "DECISION"]),
    title: z.string().min(1).max(300),
    detail: z.string().max(5000),
    tag: z.string().max(60),
    dueLabel: z.string().max(60),
    amountLabel: z.string().max(60),
    linkedProjectId: z.string().nullable(),
  }),
  z.object({ action: z.literal("delete"), itemId: z.string().min(1) }),
  z.object({
    action: z.literal("create"),
    category: z.enum(["URGENT", "RELANCE", "DECISION"]),
    title: z.string().min(1).max(300),
    detail: z.string().max(5000),
    tag: z.string().max(60),
    dueLabel: z.string().max(60),
    amountLabel: z.string().max(60),
    linkedProjectId: z.string().nullable(),
  }),
]);

export const POST = adminRoute(["DIR"], async (_ctx, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  if (body.action === "create") {
    await prisma.actionItem.create({
      data: {
        category: body.category,
        // Le tag est l'étiquette affichée sur la carte : sans saisie, la
        // catégorie fait un libellé honnête plutôt qu'une pastille vide.
        tag: body.tag.trim() || body.category,
        title: body.title.trim(),
        detail: body.detail.trim(),
        dueLabel: body.dueLabel.trim(),
        amountLabel: body.amountLabel.trim(),
        ctaLabel: "Marquer traité",
        linkedProjectId: body.linkedProjectId,
      },
    });
    return;
  }

  if (body.action === "update") {
    await prisma.actionItem.update({
      where: { id: body.itemId },
      data: {
        category: body.category,
        tag: body.tag.trim() || body.category,
        title: body.title.trim(),
        detail: body.detail.trim(),
        dueLabel: body.dueLabel.trim(),
        amountLabel: body.amountLabel.trim(),
        linkedProjectId: body.linkedProjectId,
      },
    });
    return;
  }

  if (body.action === "delete") {
    await prisma.actionItem.delete({ where: { id: body.itemId } });
    return;
  }

  // On bascule d'après l'état lu en base, pas d'après celui que le client
  // croyait voir : deux clics concurrents ne peuvent pas se contredire.
  const item = await prisma.actionItem.findUnique({
    where: { id: body.itemId },
    select: { done: true },
  });
  if (!item) badRequest("Action introuvable");

  await prisma.actionItem.update({
    where: { id: body.itemId },
    data: { done: !item.done },
  });
});
