import { z } from "zod";
import { adminRoute, parseQuery } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  project: z
    .string()
    .min(1)
    .optional()
    .describe("Projet à proposer même clôturé : celui de la fiche d'où l'on vient"),
});

// GET /api/admin/tickets/new — les listes déroulantes du formulaire de création.
export const GET = adminRoute(["DEV", "PM", "DIR"], async (_ctx, request) => {
  const query = parseQuery(querySchema, request);

  const [projects, team] = await Promise.all([
    // Les projets clôturés n'ont plus de travail à recevoir : ils noyaient le
    // sélecteur (CC-369). Seule exception, le projet d'où l'on vient, puisque
    // sa fiche, même clôturée, garde son bouton « + Nouveau ticket » (un bug
    // signalé après la clôture se rattache encore à lui).
    prisma.project.findMany({
      where: {
        OR: [{ group: { not: "CLO" } }, ...(query.project ? [{ id: query.project }] : [])],
      },
      select: {
        id: true,
        name: true,
        client: { select: { name: true } },
        epics: { orderBy: { order: "asc" }, select: { id: true, title: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({ where: { role: { in: ["DEV", "PM"] } }, orderBy: { name: "asc" } }),
  ]);

  // Le libellé « client — projet » est composé par l'écran (projectLabel) :
  // l'API ne fait que livrer les noms.
  return {
    projects,
    team: team.map((t) => ({ id: t.id, name: t.name })),
  };
}, {
  summary:
    "Listes du formulaire de création de ticket : projets non clôturés (nom, client et épics), plus le projet `project` s'il l'est, et comptes assignables.",
  query: querySchema,
});
