import { z } from "zod";
import { adminRoute, parseQuery } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { clientProjectId, clientProjects, portalProjectParam } from "@/lib/client-scope";

export const dynamic = "force-dynamic";

// GET /api/admin/client/context — le projet du client connecté, contexte commun
// à tous les écrans du portail (titre de la barre latérale, sélecteur de
// projet, phase, échéance, avancement, couverture).
//
// Le projet affiché est retenu par l'écran, mais c'est ici qu'il est validé :
// un projet qui n'est pas celui du client de la session retombe sur le premier
// de ses projets (voir lib/client-scope.ts). Les autres routes du portail
// reçoivent ensuite l'identifiant renvoyé ici.

const querySchema = z.object({ project: portalProjectParam });

export const GET = adminRoute(["CLIENT"], async ({ user }, request) => {
  const query = parseQuery(querySchema, request);
  const id = await clientProjectId(user, query.project);
  if (!id) return { project: null, projects: [] };

  const [project, projects] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        name: true,
        initials: true,
        group: true,
        phaseLabel: true,
        progressPct: true,
        deadlineAt: true,
        deadlineNote: true,
        closedAt: true,
        warrantyEndsAt: true,
        maintenanceEndsAt: true,
        lastActivityAt: true,
        client: { select: { id: true, name: true } },
      },
    }),
    clientProjects(user),
  ]);
  return { project, projects };
}, {
  summary:
    "Portail client (compte CLIENT, session seulement : un compte client n'a pas de jeton d'API). Le projet affiché (phase, échéance, avancement, garantie, maintenance) et la liste des projets de l'entreprise du client.",
  query: querySchema,
});
