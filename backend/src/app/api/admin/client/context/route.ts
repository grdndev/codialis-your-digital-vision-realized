import { adminRoute } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/client/context — le projet du client connecté, contexte commun
// à tous les écrans du portail (titre de la barre latérale, échéance, avancement).
//
// L'affectation est lue depuis la session : un client n'accède qu'au projet
// auquel il est rattaché, et aucun paramètre de requête ne peut changer cela.
export const GET = adminRoute(["CLIENT"], async ({ user }) => {
  const assignment = await prisma.projectAssignment.findFirst({
    where: { userId: user.id },
    include: { project: { include: { client: true } } },
    orderBy: { id: "asc" },
  });
  if (!assignment) return { project: null };

  const { project } = assignment;
  return {
    project: {
      id: project.id,
      name: project.name,
      initials: project.initials,
      phaseLabel: project.phaseLabel,
      progressPct: project.progressPct,
      deadlineAt: project.deadlineAt,
      deadlineNote: project.deadlineNote,
      lastActivityAt: project.lastActivityAt,
      client: { id: project.client.id, name: project.client.name },
    },
  };
});
