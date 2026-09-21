import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { projectScope } from "@/lib/project-access";
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

export const GET = adminRoute(["DIR", "PM", "DEV"], async ({ user }) => {
  // Le tableau de bord montre des projets : il suit le même cloisonnement que
  // l'écran Projets, sinon la liste y réapparaîtrait en entier.
  const scope = await projectScope(user);
  const [activeProjects, openTickets, clientCount, myInternalTasks, team, givenInternalTasks, totalProjects] =
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
