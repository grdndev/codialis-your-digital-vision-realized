import "server-only";
import { prisma } from "@/lib/prisma";

// Ce qu'un développeur a le droit de voir d'un projet.
//
// Trois titres, et non un seul : y être affecté, s'y voir confier un ticket, ou
// une tâche. L'affectation seule ne suffit pas — donner du travail à quelqu'un
// sans l'affecter au projet est courant, et lui refuser l'accès à ce sur quoi
// il travaille n'a pas de sens.
//
// La règle vit ici parce qu'elle est appliquée à plusieurs endroits : la liste
// des projets, la fiche projet, le détail d'une tâche. Deux copies qui
// divergent donnent exactement le défaut constaté — une tâche visible dans la
// fiche, mais introuvable quand on clique dessus.

export async function devCanSeeProject(userId: string, projectId: string): Promise<boolean> {
  const [assigned, ticket, task] = await Promise.all([
    prisma.projectAssignment.findFirst({ where: { projectId, userId }, select: { id: true } }),
    prisma.ticket.findFirst({ where: { projectId, assigneeId: userId }, select: { id: true } }),
    prisma.task.findFirst({
      where: { assigneeId: userId, epic: { projectId } },
      select: { id: true },
    }),
  ]);
  return Boolean(assigned || ticket || task);
}

// Les identifiants des projets visibles par un développeur, pour filtrer une
// liste en une requête plutôt qu'un contrôle par ligne.
export async function projectIdsVisibleToDev(userId: string): Promise<string[]> {
  const [assignments, tickets, tasks] = await Promise.all([
    prisma.projectAssignment.findMany({ where: { userId }, select: { projectId: true } }),
    prisma.ticket.findMany({
      where: { assigneeId: userId },
      select: { projectId: true },
      distinct: ["projectId"],
    }),
    prisma.task.findMany({
      where: { assigneeId: userId },
      select: { epic: { select: { projectId: true } } },
    }),
  ]);
  return [
    ...new Set([
      ...assignments.map((a) => a.projectId),
      ...tickets.map((t) => t.projectId),
      ...tasks.map((t) => t.epic.projectId),
    ]),
  ];
}
