import "server-only";

import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// Cloisonnement des projets pour les rôles INTERNES — règle unique, partagée
// par l'écran Projets et les filtres de l'écran Tickets.
//
// Un développeur ne voit que les projets où il a du travail : il est assigné à
// au moins une TÂCHE ou un TICKET du projet. La chefferie et la direction
// voient tout : ce sont elles qui répartissent.
//
// L'affectation par projet (`ProjectAssignment`) n'est PAS utilisée : aucun
// écran ne l'a jamais remplie, la table est vide en production, et s'y fier
// masquait tous les projets à tout le monde (TRAP-014). C'est l'assignation du
// travail — la seule chose que les écrans écrivent réellement — qui fait foi.

// Les projets visibles, ou `null` quand le rôle n'est pas cloisonné : `null`
// signifie « pas de restriction », à distinguer d'une liste vide, qui est un
// développeur sans travail assigné et donc sans aucun projet.
export async function visibleProjectIds(user: {
  id: string;
  role: Role;
}): Promise<string[] | null> {
  if (user.role !== "DEV") return null;

  const [tickets, tasks] = await Promise.all([
    prisma.ticket.findMany({
      where: { assigneeId: user.id },
      select: { projectId: true },
      distinct: ["projectId"],
    }),
    // Une tâche ne porte pas le projet : il est sur son lot.
    prisma.task.findMany({
      where: { assigneeId: user.id },
      select: { epic: { select: { projectId: true } } },
    }),
  ]);

  const ids = new Set(tickets.map((t) => t.projectId));
  for (const t of tasks) ids.add(t.epic.projectId);
  return [...ids];
}

// Version prête à poser dans un `where` Prisma : rien pour les rôles non
// cloisonnés, un `in` sinon.
export async function projectScope(user: { id: string; role: Role }) {
  const ids = await visibleProjectIds(user);
  return ids === null ? {} : { id: { in: ids } };
}

export async function devCanSeeProject(
  user: { id: string; role: Role },
  projectId: string,
): Promise<boolean> {
  const ids = await visibleProjectIds(user);
  return ids === null || ids.includes(projectId);
}
