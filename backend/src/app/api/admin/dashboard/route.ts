import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { projectScope } from "@/lib/project-access";
import { goalsFor } from "@/lib/goals";
import type { TaskStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

// Écran « Dashboard ».
//
// Ouvert aussi aux développeurs : c'est la seule vue d'ensemble de l'agence, et
// travailler sans savoir où en sont les autres projets n'aide personne.
//
// Les tâches internes sont ouvertes à toute l'équipe : chacun s'en pose à
// soi-même — un rappel, une relance — et peut en confier à un collègue. Elles
// étaient réservées à la direction, qui ne pouvait d'ailleurs les confier qu'à
// une cheffe de projet : ni à elle-même, ni à un développeur.
//
// Les objectifs du mois (CC-347) sont posés par la direction et lus par toute
// l'équipe : ceux encore en cours, et ceux clos depuis le début du mois. Le
// début du mois vient de l'écran (`monthStart`), comme sur Pilotage : c'est lui
// qui dit de quel mois il parle. Ils s'écrivent par la route de l'écran
// Objectifs (src/lib/goals.ts).

export const GET = adminRoute(["DIR", "PM", "DEV"], async ({ user }, request) => {
  const requestedStart = new Date(request.nextUrl.searchParams.get("monthStart") ?? "");
  const now = new Date();
  const monthStart = Number.isNaN(requestedStart.getTime())
    ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    : requestedStart;
  // Le tableau de bord montre des projets : il suit le même cloisonnement que
  // l'écran Projets, sinon la liste y réapparaîtrait en entier.
  const scope = await projectScope(user);
  const [activeProjects, openTickets, clientCount, myInternalTasks, team, givenInternalTasks, totalProjects, goals, goalProjects] =
    await Promise.all([
      prisma.project.findMany({
        where: { group: "DEV", ...scope },
        include: { client: true },
        orderBy: { lastActivityAt: "desc" },
      }),
      prisma.ticket.findMany({
        where: { status: { not: "TERMINE" } },
        include: { project: true },
      }),
      prisma.client.count(),
      prisma.internalTask.findMany({
        where: { assigneeId: user.id, status: { not: "TERMINE" } },
        include: { assigner: true },
        orderBy: { createdAt: "desc" },
      }),
      // Toute l'équipe interne est assignable, soi-même compris.
      prisma.user.findMany({
        where: { role: { in: ["DEV", "PM", "DIR"] } },
        orderBy: { name: "asc" },
      }),
      prisma.internalTask.findMany({
        where: { assignerId: user.id },
        include: { assignee: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.project.count({ where: scope }),
      goalsFor(user, { OR: [{ closedAt: null }, { closedAt: { gte: monthStart } }] }),
      // Les projets rattachables à un objectif, pour le formulaire de la
      // direction : personne d'autre n'en pose.
      user.role === "DIR"
        ? prisma.project.findMany({
            where: { group: { not: "CLO" } },
            select: { id: true, name: true, client: { select: { name: true } } },
            orderBy: { name: "asc" },
          })
        : [],
    ]);

  return {
    activeProjects,
    openTickets,
    clientCount,
    myInternalTasks,
    // Les comptes ne sortent qu'en identité d'affichage : pas de hash, pas d'e-mail.
    team: team.map((u) => ({ id: u.id, name: u.name, initials: u.initials, role: u.role })),
    givenInternalTasks,
    totalProjects,
    goals,
    goalProjects,
  };
});

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  A_FAIRE: "EN_COURS",
  EN_COURS: "EN_REVUE",
  EN_REVUE: "TERMINE",
  TERMINE: null,
};

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("assign-internal-task"),
    assigneeId: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    dueAt: z.string().datetime().nullable(),
  }),
  z.object({
    action: z.literal("advance-internal-task"),
    taskId: z.string().min(1),
  }),
]);

// Poser une tâche interne et faire avancer la sienne appartiennent à toute
// l'équipe.
export const POST = adminRoute(["DIR", "PM", "DEV"], async ({ user }, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  if (body.action === "assign-internal-task") {
    await prisma.internalTask.create({
      data: {
        title: body.title,
        description: body.description,
        assigneeId: body.assigneeId,
        assignerId: user.id,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
      },
    });
    return;
  }

  const task = await prisma.internalTask.findUnique({ where: { id: body.taskId } });
  if (!task) badRequest("Tâche introuvable");
  // On avance sa propre tâche, ou celle qu'on a soi-même confiée — la
  // direction, elle, peut reprendre n'importe laquelle.
  if (task.assigneeId !== user.id && task.assignerId !== user.id && user.role !== "DIR") {
    badRequest("Tâche d'un autre membre");
  }

  const nextStatus = NEXT_STATUS[task.status];
  if (!nextStatus) return;
  await prisma.internalTask.update({ where: { id: body.taskId }, data: { status: nextStatus } });
});
