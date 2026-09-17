import { z } from "zod";
import { adminRoute, badRequest } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/tickets/detail?ref=  — un ticket et tout son dossier.
// Renvoie `{ ticket: null }` sur une référence inconnue : c'est l'écran qui
// décide d'afficher un 404, l'API ne fait que constater l'absence.

const querySchema = z.object({ ref: z.string().min(1) });

export const GET = adminRoute(["DEV", "PM", "DIR"], async (_ctx, request) => {
  const parsed = querySchema.safeParse({ ref: request.nextUrl.searchParams.get("ref") });
  if (!parsed.success) badRequest("Référence invalide");

  const ticket = await prisma.ticket.findUnique({
    where: { ref: parsed.data.ref },
    include: {
      project: { include: { client: true } },
      epic: true,
      assignee: true,
      creator: true,
      criteria: { orderBy: { order: "asc" } },
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      attachments: true,
    },
  });
  if (!ticket) return { ticket: null };

  // De quoi alimenter le formulaire de modification : les épics du projet et
  // l'équipe interne, à qui le ticket peut être réassigné.
  const [epics, team, projects] = await Promise.all([
    prisma.epic.findMany({
      where: { projectId: ticket.projectId },
      orderBy: { order: "asc" },
      select: { id: true, title: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["DEV", "PM", "DIR"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Pour pouvoir déplacer le ticket : un ticket déposé sur le mauvais projet
    // n'avait aucun moyen d'en changer.
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, client: { select: { name: true } } },
    }),
  ]);

  return { ticket, epics, team, projects };
});
