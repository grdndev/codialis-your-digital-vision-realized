import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import type { TaskStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

// Écran « Dashboard » (direction et cheffes de projet).
//
// Les listes propres à la direction (les CP assignables, les tâches qu'elle a
// distribuées) ne sont interrogées que pour un DIR : une CP reçoit des tableaux
// vides, elle n'a pas à connaître ces données.

export const GET = adminRoute(["DIR", "PM"], async ({ user }) => {
  const isDir = user.role === "DIR";
  const [activeProjects, openTickets, clientCount, myInternalTasks, pmUsers, givenInternalTasks, totalProjects] =
    await Promise.all([
      prisma.project.findMany({
        where: { group: "DEV" },
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
      isDir ? prisma.user.findMany({ where: { role: "PM" }, orderBy: { name: "asc" } }) : [],
      isDir
        ? prisma.internalTask.findMany({
            where: { assignerId: user.id },
            include: { assignee: true },
            orderBy: { createdAt: "desc" },
          })
        : [],
      prisma.project.count(),
    ]);

  return {
    activeProjects,
    openTickets,
    clientCount,
    myInternalTasks,
    // Les comptes ne sortent qu'en identité d'affichage : pas de hash, pas d'e-mail.
    pmUsers: pmUsers.map((u) => ({ id: u.id, name: u.name, initials: u.initials, role: u.role })),
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

export const POST = adminRoute(["DIR", "PM"], async ({ user }, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  if (body.action === "assign-internal-task") {
    // Distribuer une tâche interne est une prérogative de la direction.
    if (user.role !== "DIR") badRequest("Réservé à la direction");
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
  // On n'avance que sa propre tâche — ou n'importe laquelle si l'on est la
  // direction, qui les a distribuées.
  if (task.assigneeId !== user.id && user.role !== "DIR") badRequest("Tâche d'un autre membre");

  const nextStatus = NEXT_STATUS[task.status];
  if (!nextStatus) return;
  await prisma.internalTask.update({ where: { id: body.taskId }, data: { status: nextStatus } });
});
