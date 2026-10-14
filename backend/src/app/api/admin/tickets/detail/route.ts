import { z } from "zod";
import { adminRoute, parseQuery } from "@/lib/admin-api";
import { avecUrlPublique } from "@/lib/files";
import { prisma } from "@/lib/prisma";
import { USER_IDENTITY } from "@/lib/user-identity";
import { sessionsOf } from "@/lib/work-sessions";

export const dynamic = "force-dynamic";

// GET /api/admin/tickets/detail?ref=  — un ticket et tout son dossier.
// GET /api/admin/tickets/detail?id=   — le même, par son identifiant : c'est
// ce que portent les adresses des anciennes tâches (/projects/…/tasks/<id>),
// devenues des tickets sous le même identifiant (CC-365).
// Renvoie `{ ticket: null }` sur une référence inconnue : c'est l'écran qui
// décide d'afficher un 404, l'API ne fait que constater l'absence.

const querySchema = z
  .object({
    ref: z.string().min(1).optional().describe("Référence du ticket (ex. « CC-365 »)"),
    id: z.string().min(1).optional().describe("Identifiant du ticket"),
  })
  .refine((q) => q.ref || q.id, { message: "Référence ou identifiant requis" });

export const GET = adminRoute(["DEV", "PM", "DIR"], async (_ctx, request) => {
  const query = parseQuery(querySchema, request, "Référence invalide");

  const ticket = await prisma.ticket.findUnique({
    where: query.ref ? { ref: query.ref } : { id: query.id },
    include: {
      project: { include: { client: true } },
      epic: true,
      assignee: USER_IDENTITY,
      creator: USER_IDENTITY,
      criteria: { orderBy: { order: "asc" } },
      comments: { include: { author: USER_IDENTITY }, orderBy: { createdAt: "asc" } },
      attachments: true,
    },
  });
  if (!ticket) return { ticket: null };

  // De quoi alimenter le formulaire de modification : les épics du projet et
  // l'équipe interne, à qui le ticket peut être réassigné.
  const [epics, team, projects, sessions] = await Promise.all([
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
    // Le temps mesuré, session par session, corrigeable après coup.
    sessionsOf(prisma, { ticketId: ticket.id }),
  ]);

  return {
    ticket: { ...ticket, attachments: ticket.attachments.map(avecUrlPublique) },
    epics,
    team,
    projects,
    sessions,
  };
}, {
  summary:
    "Un ticket et tout son dossier : description, étapes, critères, commentaires, pièces jointes (avec leur `url` publique), sessions de temps mesuré. `ticket` vaut null si la référence est inconnue. `epics`, `team` et `projects` alimentent le formulaire de modification.",
  query: querySchema,
});
