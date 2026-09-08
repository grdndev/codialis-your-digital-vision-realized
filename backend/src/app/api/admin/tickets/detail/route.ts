import { z } from "zod";
import { adminRoute, badRequest } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/tickets/detail?ref=  — un ticket et tout son dossier.
// Renvoie `{ ticket: null }` sur une référence inconnue : c'est l'écran qui
// décide d'afficher un 404, l'API ne fait que constater l'absence.

const querySchema = z.object({ ref: z.string().min(1) });

export const GET = adminRoute(["DEV", "PM", "DIR"], async ({ user }, request) => {
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

  // Même cloisonnement que la liste : un développeur n'ouvre que les tickets
  // des projets sur lesquels il est affecté, y compris par URL directe.
  if (user.role === "DEV") {
    const assignment = await prisma.projectAssignment.findFirst({
      where: { userId: user.id, projectId: ticket.projectId },
      select: { id: true },
    });
    if (!assignment) return { ticket: null };
  }

  return { ticket };
});
